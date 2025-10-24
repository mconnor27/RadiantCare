import type { Physician, FutureYear, PhysicianType } from './types'
import {
  calculateEmployeeTotalCost,
  calculateDelayedW2Payment,
  getEmployeePortionOfYear,
  getPartnerFTEWeightProper
} from './calculations'
import { getDefaultTrailingSharedMdAmount } from './tooltips'
import {
  DEFAULT_MD_SHARED_PROJECTION,
  DEFAULT_MD_PRCS_PROJECTION
} from './defaults'
import { logger } from '../../../lib/logger'

export type CompensationResult = {
  id: string
  name: string
  type: PhysicianType
  comp: number
  breakdown?: {
    fteShare?: number
    mdAllocation?: number
    additionalDaysAllocation?: number
    buyout?: number
    delayedW2?: number
    trailingMd?: number
    w2Salary?: number
  }
}

export interface CompensationParams {
  physicians: Physician[]
  year: number
  fy: FutureYear
  benefitCostsGrowthPct: number
  includeRetired?: boolean
  excludeW2FromComp?: boolean  // If true, W2 is tracked in breakdown but not included in comp total
}

/**
 * Calculate all physician compensations (partners + employees) using the canonical methodology.
 * This is the single source of truth for compensation calculations.
 *
 * Methodology:
 * 1. Calculate total employee costs (wages + benefits + payroll taxes)
 * 2. Calculate buyout costs for retiring partners
 * 3. Calculate delayed W2 costs for employeeToPartner transitions
 * 4. Calculate Medical Director allocations (shared + PRCS) - direct to partners
 * 5. Calculate Additional Days Worked allocations - direct to partners
 * 6. Calculate total income from ALL sources: therapy + MD + PRCS + consulting
 * 7. Calculate pool: totalIncome - totalCosts - mdAllocations - additionalDaysAllocations
 * 8. Distribute pool by partner FTE weight
 * 9. Add direct allocations (MD, Additional Days, buyouts, trailing) to each partner
 * 10. Add employees with their W2 salary compensation
 */
export function calculateAllCompensations(params: CompensationParams): CompensationResult[] {
  const { physicians, year, fy, benefitCostsGrowthPct, includeRetired = false, excludeW2FromComp = false } = params

  // Separate partners and employees
  const partners = physicians.filter((p) =>
    p.type === 'partner' || p.type === 'employeeToPartner' || p.type === 'partnerToRetire'
  )
  const employees = physicians.filter((p) =>
    p.type === 'employee' || p.type === 'employeeToPartner' ||
    p.type === 'newEmployee' || p.type === 'employeeToTerminate'
  )

  // === STEP 1: Calculate total employee costs ===
  const totalEmployeeCosts = employees.reduce((sum, e) => {
    const employeePortion = getEmployeePortionOfYear(e)
    if (employeePortion <= 0) return sum

    if (e.type === 'newEmployee') {
      const prorated = { ...e, salary: (e.salary ?? 0) * employeePortion }
      return sum + calculateEmployeeTotalCost(prorated, year, benefitCostsGrowthPct)
    } else if (e.type === 'employeeToTerminate') {
      const prorated = { ...e, salary: (e.salary ?? 0) * employeePortion }
      return sum + calculateEmployeeTotalCost(prorated, year, benefitCostsGrowthPct)
    } else if (e.type === 'employeeToPartner') {
      const employeePortionSalary = (e.salary ?? 0) * employeePortion
      const employeePortionPhysician = { ...e, salary: employeePortionSalary }
      return sum + calculateEmployeeTotalCost(employeePortionPhysician, year, benefitCostsGrowthPct)
    } else {
      return sum + calculateEmployeeTotalCost(e, year, benefitCostsGrowthPct)
    }
  }, 0)

  // === STEP 2: Calculate buyout costs ===
  const totalBuyoutCosts = partners.reduce((sum, p) => {
    if (p.type === 'partnerToRetire') {
      // Include buyout regardless of FTE weight - it's a real cost to the company
      // For year-round retirees (weight > 0), it's part of normal costs
      // For prior-year retirees (weight = 0), it's still owed and should reduce the pool
      return sum + (p.buyoutCost ?? 0)
    }
    return sum
  }, 0)

  // === STEP 3: Calculate delayed W2 costs ===
  const totalDelayedW2Costs = physicians.reduce((sum, p) => {
    if (p.type === 'employeeToPartner') {
      const delayed = calculateDelayedW2Payment(p, year)
      return sum + delayed.amount + delayed.taxes
    }
    return sum
  }, 0)

  // === STEP 4: Calculate Medical Director allocations ===
  const medicalDirectorIncome = fy.medicalDirectorHours ?? DEFAULT_MD_SHARED_PROJECTION
  const prcsMedicalDirectorIncome = fy.prcsDirectorPhysicianId
    ? (fy.prcsMedicalDirectorHours ?? DEFAULT_MD_PRCS_PROJECTION)
    : 0

  const partnerMedicalDirectorAllocations = new Map<string, number>()

  // First, calculate total trailing MD amounts for prior-year retirees
  // These are fixed dollar amounts (part of the 100% total)
  const trailingMdTotal = partners.reduce((sum, p) => {
    const isPriorYearRetired = p.type === 'partnerToRetire' && (p.partnerPortionOfYear ?? 0) === 0
    if (isPriorYearRetired) {
      return sum + (p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p))
    }
    return sum
  }, 0)

  // Allocate shared Medical Director income to ACTIVE partners based on percentages
  // Percentages are absolute (out of 100% total budget), not relative to remainder
  // Prior-year retirees get their fixed amounts which are also part of the 100%
  for (const partner of partners) {
    const isPriorYearRetired = partner.type === 'partnerToRetire' && (partner.partnerPortionOfYear ?? 0) === 0
    if (!isPriorYearRetired && partner.hasMedicalDirectorHours && partner.medicalDirectorHoursPercentage) {
      const allocation = (partner.medicalDirectorHoursPercentage / 100) * medicalDirectorIncome
      partnerMedicalDirectorAllocations.set(partner.id, allocation)
    }
  }

  // Allocate PRCS Medical Director income directly to the assigned physician
  if (fy.prcsDirectorPhysicianId && prcsMedicalDirectorIncome > 0) {
    const currentPrcsAllocation = partnerMedicalDirectorAllocations.get(fy.prcsDirectorPhysicianId) ?? 0
    partnerMedicalDirectorAllocations.set(fy.prcsDirectorPhysicianId, currentPrcsAllocation + prcsMedicalDirectorIncome)
  }

  // Total MD allocations includes both active partner allocations AND retiree trailing amounts
  const totalMedicalDirectorAllocations = Array.from(partnerMedicalDirectorAllocations.values())
    .reduce((sum, allocation) => sum + allocation, 0) + trailingMdTotal

  // === STEP 5: Calculate Additional Days Worked allocations ===
  const partnerAdditionalDaysAllocations = new Map<string, number>()
  for (const partner of partners) {
    if (partner.additionalDaysWorked && partner.additionalDaysWorked > 0) {
      partnerAdditionalDaysAllocations.set(partner.id, partner.additionalDaysWorked)
    }
  }
  const totalAdditionalDaysAllocations = Array.from(partnerAdditionalDaysAllocations.values())
    .reduce((sum, allocation) => sum + allocation, 0)

  // === STEP 6: Calculate total income from ALL sources ===
  const totalIncome = (fy.therapyIncome ?? 0) +
                      medicalDirectorIncome +
                      prcsMedicalDirectorIncome +
                      (fy.consultingServicesAgreement ?? 0)

  // === STEP 7: Calculate pool ===
  const totalCosts = (fy.nonEmploymentCosts ?? 0) +
                     (fy.nonMdEmploymentCosts ?? 0) +
                     (fy.miscEmploymentCosts ?? 0) +
                     (fy.locumCosts ?? 0) +
                     totalEmployeeCosts +
                     totalBuyoutCosts +
                     totalDelayedW2Costs

  const basePool = Math.max(0, totalIncome - totalCosts)
  const pool = Math.max(0, basePool - totalMedicalDirectorAllocations - totalAdditionalDaysAllocations)

  // Log compensation calculation
  logger.debug('COMPENSATION', 'Calculation completed', {
    year,
    summary: {
      income: totalIncome,
      costs: totalCosts,
      pool,
      partners: partners.length,
      employees: employees.length
    },
    income: {
      therapy: fy.therapyIncome ?? 0,
      mdShared: medicalDirectorIncome,
      mdPRCS: prcsMedicalDirectorIncome,
      consulting: fy.consultingServicesAgreement ?? 0
    },
    costs: {
      nonEmployment: fy.nonEmploymentCosts ?? 0,
      nonMdEmployment: fy.nonMdEmploymentCosts ?? 0,
      misc: fy.miscEmploymentCosts ?? 0,
      locum: fy.locumCosts ?? 0,
      employees: totalEmployeeCosts,
      buyouts: totalBuyoutCosts,
      delayedW2: totalDelayedW2Costs
    },
    allocations: {
      mdTotal: totalMedicalDirectorAllocations,
      additionalDays: totalAdditionalDaysAllocations
    }
  })

  // === STEP 8: Distribute pool by FTE weight ===
  const partnerFTEs = partners.map((p) => ({ p, weight: getPartnerFTEWeightProper(p) }))
  const totalWeight = partnerFTEs.reduce((s, x) => s + x.weight, 0) || 1

  const results: CompensationResult[] = []

  // === STEP 9: Add partners with allocations ===
  for (const { p, weight } of partnerFTEs) {
    // Skip prior-year retirees with no working portion unless includeRetired is true
    if (p.type === 'partnerToRetire' && weight === 0 && !includeRetired) {
      continue
    }

    const fteShare = (weight / totalWeight) * pool
    const additionalDaysAllocation = partnerAdditionalDaysAllocations.get(p.id) ?? 0
    const buyout = p.type === 'partnerToRetire' ? (p.buyoutCost ?? 0) : 0

    // For prior-year retirees (no working portion), use trailing shared MD amount instead of calculated allocation
    const isPriorYearRetired = p.type === 'partnerToRetire' && (p.partnerPortionOfYear ?? 0) === 0
    const mdAllocation = isPriorYearRetired
      ? 0  // Prior-year retirees don't get calculated MD allocation
      : (partnerMedicalDirectorAllocations.get(p.id) ?? 0)

    const trailingMd = isPriorYearRetired
      ? (p.trailingSharedMdAmount ?? getDefaultTrailingSharedMdAmount(p))
      : 0

    // For employeeToPartner, track their W2 salary portion separately (shown as annotation, not in comp)
    const w2Salary = p.type === 'employeeToPartner'
      ? (p.salary ?? 0) * getEmployeePortionOfYear(p)
      : 0

    // For employeeToPartner, also track their delayed W2 payment separately (prior year work)
    const delayedW2 = p.type === 'employeeToPartner'
      ? calculateDelayedW2Payment(p, year).amount
      : 0

    // Calculate comp based on excludeW2FromComp flag
    // When excludeW2FromComp is true (YearPanel box), W2 is shown separately as annotation
    // When false (everywhere else), W2 is included in total compensation
    const comp = excludeW2FromComp
      ? fteShare + mdAllocation + additionalDaysAllocation + buyout + trailingMd
      : fteShare + mdAllocation + additionalDaysAllocation + buyout + w2Salary + delayedW2 + trailingMd

    results.push({
      id: p.id,
      name: p.name,
      type: 'partner',
      comp,
      breakdown: {
        fteShare,
        mdAllocation,
        additionalDaysAllocation,
        buyout,
        delayedW2,
        trailingMd,
        w2Salary
      }
    })
  }

  // === STEP 10: Add employees with W2 salary ===
  const employeeOnly = physicians.filter((p) =>
    p.type === 'employee' || p.type === 'newEmployee' || p.type === 'employeeToTerminate'
  )

  for (const e of employeeOnly) {
    const portion = getEmployeePortionOfYear(e)
    const w2Salary = (e.salary ?? 0) * (e.type === 'employee' ? 1 : portion)

    results.push({
      id: e.id,
      name: e.name,
      type: e.type,
      comp: w2Salary,
      breakdown: {
        w2Salary
      }
    })
  }

  return results
}

/**
 * Calculate all compensations including prior-year retired partners with zero FTE weight.
 * This variant is used for multi-year compensation tables where we want to show
 * retired partners with their buyout + trailing MD amounts even if they didn't work.
 */
export function calculateAllCompensationsWithRetired(params: Omit<CompensationParams, 'includeRetired'>): CompensationResult[] {
  return calculateAllCompensations({ ...params, includeRetired: true })
}
