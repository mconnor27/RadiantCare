import type { Physician, FutureYear, YearRow } from './types'
import {
  clamp,
  daysInYear,
  calculateBenefitStartDay,
  startPortionToStartDay,
  employeePortionToTransitionDay,
  getPayPeriodsForYear
} from './utils'
import {
  MONTHLY_BENEFITS_MED,
  MONTHLY_BENEFITS_DENTAL,
  MONTHLY_BENEFITS_VISION,
  ANNUAL_BENEFITS_FULLTIME,
  SOCIAL_SECURITY_WAGE_BASES,
  TAX_RATES,
  DEFAULT_CONSULTING_SERVICES_2024,
  DEFAULT_CONSULTING_SERVICES_2025,
  DEFAULT_CONSULTING_SERVICES_PROJECTION,
  ACTUAL_2024_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2025_MEDICAL_DIRECTOR_HOURS,
  ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS,
  DEFAULT_MD_SHARED_PROJECTION,
  DEFAULT_MD_PRCS_PROJECTION
} from './defaults'

export function getSocialSecurityWageBase(year: number): number {
  return SOCIAL_SECURITY_WAGE_BASES[year as keyof typeof SOCIAL_SECURITY_WAGE_BASES] || SOCIAL_SECURITY_WAGE_BASES[2030] // Use 2030 as fallback for later years
}

// Helper: employer payroll taxes for W2 annual wages (WA State medical practice <50 employees)
export function calculateEmployerPayrollTaxes(annualWages: number, year: number = 2025): number {
  const ssWageBase = getSocialSecurityWageBase(year)
  
  // Federal taxes
  const federalUnemploymentTax = Math.min(annualWages, TAX_RATES.federalUnemploymentWageBase) * TAX_RATES.federalUnemploymentRate
  const socialSecurityTax = Math.min(annualWages, ssWageBase) * TAX_RATES.socialSecurityRate
  const medicareTax = annualWages * TAX_RATES.medicareRate
  // Note: Additional Medicare tax (0.9% over $200K) is employee-paid, not employer-paid

  // Washington State taxes
  const waUnemploymentTax = Math.min(annualWages, TAX_RATES.waUnemploymentWageBase) * TAX_RATES.waUnemploymentRate
  const waFamilyLeaveTax = Math.min(annualWages, ssWageBase) * TAX_RATES.waFamilyLeaveRate // WA FLI: 0.658% on first SS wage base
  const waStateDisabilityTax = annualWages * TAX_RATES.waStateDisabilityRate // WA SDI: 0.255% on all wages
  const washingtonRateTax = annualWages * TAX_RATES.washingtonRate // Washington Rate: 0.030% on all wages
  
  return federalUnemploymentTax + socialSecurityTax + medicareTax + 
         waUnemploymentTax + waFamilyLeaveTax + waStateDisabilityTax + washingtonRateTax
}

// Helper: Calculate benefit costs for a given year with growth applied
export function getBenefitCostsForYear(year: number, benefitGrowthPct: number): number {
  const baseYear = 2025
  const baseCost = (MONTHLY_BENEFITS_MED + MONTHLY_BENEFITS_DENTAL + MONTHLY_BENEFITS_VISION) * 12
  if (year <= baseYear) {
    return baseCost
  }
  const yearsOfGrowth = year - baseYear
  const growthMultiplier = Math.pow(1 + benefitGrowthPct / 100, yearsOfGrowth)
  return baseCost * growthMultiplier
}

// Default Staff employment costs (wages + employer taxes + benefits for FT 1)
export function computeDefaultNonMdEmploymentCosts(year: number = 2025): number {
  // Calculate based on standard staff structure (for any year including 2025)
  // Employee 1: $31.25/hr, 40 hrs/week, full-time + benefits
  const emp1Wages = 31.25 * 40 * 52
  const emp1Taxes = calculateEmployerPayrollTaxes(emp1Wages, year)
  const emp1Total = emp1Wages + emp1Taxes + ANNUAL_BENEFITS_FULLTIME
  // Employee 2: $27/hr, 32 hrs/week, part-time (no benefits specified)
  const emp2Wages = 27 * 32 * 52
  const emp2Taxes = calculateEmployerPayrollTaxes(emp2Wages, year)
  const emp2Total = emp2Wages + emp2Taxes
  // Employee 3: $23/hr, 20 hrs/week, part-time
  const emp3Wages = 23 * 20 * 52
  const emp3Taxes = calculateEmployerPayrollTaxes(emp3Wages, year)
  const emp3Total = emp3Wages + emp3Taxes
  return Math.round(emp1Total + emp2Total + emp3Total)
}

// Calculate total cost for an employee including benefits and payroll taxes (WA State medical practice <50 employees)
export function calculateEmployeeTotalCost(employee: Physician, year: number = 2025, benefitGrowthPct: number = 5.0): number {
  
  const baseSalary = employee.salary || 0
  const bonusAmount = employee.bonusAmount || 0
  
  // Monthly benefits (convert to annual) - only if employee receives benefits
  let annualBenefits = 0
  if (employee.receivesBenefits) {
    const yearlyBenefitCost = getBenefitCostsForYear(year, benefitGrowthPct)
    if (employee.type === 'newEmployee') {
      // For new employees, use the new benefit waiting period calculation
      const startDay = startPortionToStartDay(employee.startPortionOfYear ?? 0, year)
      const benefitStartDay = calculateBenefitStartDay(startDay, year)
      const totalDays = daysInYear(year)
      
      // Only count benefits if they start within this year
      if (benefitStartDay <= totalDays) {
        const benefitDays = Math.max(0, totalDays - benefitStartDay + 1)
        const benefitPortion = benefitDays / totalDays
        annualBenefits = yearlyBenefitCost * benefitPortion
      }
    } else {
      // For regular employees and mixed types, full benefits if they receive them
      annualBenefits = yearlyBenefitCost
    }
  }
  
  // Calculate all employer payroll taxes using the comprehensive function
  const totalPayrollTaxes = calculateEmployerPayrollTaxes(baseSalary, year)
  
  return baseSalary + annualBenefits + totalPayrollTaxes + bonusAmount
}

// Mixed type helpers
export function getEmployeePortionOfYear(physician: Physician): number {
  if (physician.type === 'employee') return 1
  if (physician.type === 'partner') return 0
  if (physician.type === 'newEmployee') {
    // New employees work from their start date to end of year
    const startPortion = physician.startPortionOfYear ?? 0
    return 1 - startPortion
  }
  if (physician.type === 'employeeToTerminate') {
    // Terminating employees work from beginning of year to termination date
    const terminatePortion = physician.terminatePortionOfYear ?? 1
    return terminatePortion
  }
  const val = physician.employeePortionOfYear ?? 0.5
  return clamp(val, 0, 1)
}

export function getPartnerPortionOfYear(physician: Physician): number {
  if (physician.type === 'employee') return 0
  if (physician.type === 'newEmployee') return 0
  if (physician.type === 'employeeToTerminate') return 0
  if (physician.type === 'partner') return 1
  if (physician.type === 'employeeToPartner') return 1 - getEmployeePortionOfYear(physician)
  if (physician.type === 'partnerToRetire') return physician.partnerPortionOfYear ?? 0.5
  return 0
}

export function getPartnerFTEWeight(physician: Physician): number {
  // Allow up to 24 weeks for historical data compatibility
  const weeks = clamp(physician.weeksVacation ?? 0, 0, 24)
  const baseFte = 1 - weeks / 52
  return baseFte * getPartnerPortionOfYear(physician)
}

// Calculate FTE weight properly accounting for vacation during partner working period
export function getPartnerFTEWeightProper(physician: Physician): number {
  const partnerPortion = getPartnerPortionOfYear(physician)
  if (partnerPortion === 0) return 0
  
  const weeksVacation = clamp(physician.weeksVacation ?? 0, 0, 24)
  const partnerWeeksInYear = partnerPortion * 52
  
  // Vacation is taken during the partner working period
  const effectivePartnerWeeks = Math.max(0, partnerWeeksInYear - weeksVacation)
  
  // Return as fraction of full year for comparison
  return effectivePartnerWeeks / 52
}

export function calculateDelayedW2Payment(physician: Physician, year: number): { amount: number; taxes: number; periodDetails: string } {
  if (physician.type !== 'employeeToPartner') {
    return { amount: 0, taxes: 0, periodDetails: '' }
  }
  
  // Manual override for Connor in 2025
  if (physician.name === 'Connor' && year === 2025) {
    return {
      amount: 15289.23,
      taxes: 1493.36,
      periodDetails: '12/14/24-12/27/24, 12/28/24-12/31/24 (manual override)'
    }
  }
  
  const transitionDay = employeePortionToTransitionDay(physician.employeePortionOfYear ?? 0.5, year)
  const transitionDate = new Date(year, 0, transitionDay) // Convert to actual date
  
  const periods = getPayPeriodsForYear(year)
  const salary = physician.salary ?? 0
  
  // Calculate hourly rate: salary ÷ (52 weeks × 5 days × 8 hours)
  const annualWorkHours = 52 * 5 * 8  // 2,080 hours per year
  const hourlyRate = salary / annualWorkHours
  
  let totalWorkDays = 0
  let periodDetails: string[] = []
  
  // Helper function to count business days (Mon-Fri) in a date range
  function countBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0
    const current = new Date(startDate)
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay()
      // 1 = Monday through 5 = Friday
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++
      }
      current.setDate(current.getDate() + 1)
    }
    
    return count
  }
  
  // Find periods where work was done in prior year but paid in current year
  for (const period of periods) {
    // Skip periods where pay date is before transition date
    if (period.payDate < transitionDate) continue
    
    // Check if work period was in prior year
    if (period.periodStart.getFullYear() < year || period.periodEnd.getFullYear() < year) {
      // Calculate business days in prior year
      const priorYearEnd = new Date(year - 1, 11, 31)
      const periodStartInPriorYear = period.periodStart.getFullYear() < year ? period.periodStart : new Date(year, 0, 1)
      const periodEndInPriorYear = period.periodEnd.getFullYear() < year ? period.periodEnd : priorYearEnd
      
      if (periodStartInPriorYear <= priorYearEnd) {
        const businessDaysInPriorYear = countBusinessDays(periodStartInPriorYear, periodEndInPriorYear)
        totalWorkDays += businessDaysInPriorYear
        
        const periodStartStr = `${periodStartInPriorYear.getMonth() + 1}/${periodStartInPriorYear.getDate()}`
        const periodEndStr = `${periodEndInPriorYear.getMonth() + 1}/${periodEndInPriorYear.getDate()}`
        const payDateStr = `${period.payDate.getMonth() + 1}/${period.payDate.getDate()}`
        periodDetails.push(`${periodStartStr}-${periodEndStr} (paid ${payDateStr}, ${businessDaysInPriorYear} work days)`)
      }
    }
  }
  
  // Calculate total amount: business days × 8 hours/day × hourly rate
  const amount = totalWorkDays * 8 * hourlyRate
  const taxes = calculateEmployerPayrollTaxes(amount, year)
  
  return {
    amount: Math.round(amount),
    taxes: Math.round(taxes),
    periodDetails: periodDetails.join(', ')
  }
}

// Generate tooltip content for employee cost breakdown (WA State medical practice <50 employees)
export function getEmployeeCostTooltip(employee: Physician, year: number = 2025, benefitGrowthPct: number = 5.0, delayedW2Amount: number = 0, delayedW2Taxes: number = 0, delayedW2Details: string = ''): string {
  
  const baseSalary = employee.salary || 0
  const bonusAmount = employee.bonusAmount || 0
  
  // Calculate benefits with new waiting period for new employees
  let benefits = 0
  let benefitsNote = ''
  if (employee.receivesBenefits) {
    const yearlyBenefitCost = getBenefitCostsForYear(year, benefitGrowthPct)
    if (employee.type === 'newEmployee') {
      const startDay = startPortionToStartDay(employee.startPortionOfYear ?? 0, year)
      const benefitStartDay = calculateBenefitStartDay(startDay, year)
      const totalDays = daysInYear(year)
      
      if (benefitStartDay <= totalDays) {
        const benefitDays = Math.max(0, totalDays - benefitStartDay + 1)
        const benefitPortion = benefitDays / totalDays
        benefits = yearlyBenefitCost * benefitPortion
        benefitsNote = ` (prorated from day ${benefitStartDay})`
      } else {
        benefitsNote = ' (starts next year)'
      }
    } else {
      benefits = yearlyBenefitCost
    }
  }
  
  // Calculate payroll taxes
  const payrollTaxes = calculateEmployerPayrollTaxes(baseSalary, year)
  
  // Format values
  const formattedSalary = baseSalary.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const formattedBonus = bonusAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const formattedBenefits = benefits.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const formattedTaxes = payrollTaxes.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const formattedDelayedW2 = delayedW2Amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const formattedDelayedW2Taxes = delayedW2Taxes.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  
  // Calculate total
  const total = baseSalary + bonusAmount + benefits + payrollTaxes + delayedW2Amount + delayedW2Taxes
  const formattedTotal = total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  
  // Build tooltip content
  let tooltip = `Base Salary: ${formattedSalary}\n`
  
  if (bonusAmount > 0) {
    tooltip += `Bonus: ${formattedBonus}\n`
  }
  
  if (employee.receivesBenefits) {
    tooltip += `Benefits: ${formattedBenefits}${benefitsNote}\n`
  }
  
  tooltip += `Employer Taxes: ${formattedTaxes}\n`
  
  if (delayedW2Amount > 0) {
    tooltip += `Prior Year W2: ${formattedDelayedW2}\n`
    tooltip += `Prior Year Taxes: ${formattedDelayedW2Taxes}\n`
    if (delayedW2Details) {
      tooltip += `Periods: ${delayedW2Details}\n`
    }
  }
  
  tooltip += `\nTotal: ${formattedTotal}`

  return tooltip
}


// Helper function to calculate true total income for any year
export function getTotalIncome(yearData: YearRow | FutureYear): number {
  // For historic years 2016-2023, therapyIncome represents total income (no separate MD data)
  if ('year' in yearData && yearData.year <= 2023) {
    return yearData.therapyIncome
  }
  
  // For 2024+ (including historic 2024-2025), calculate therapy + medical director income
  const therapyIncome = yearData.therapyIncome || 0
  
  // For historic years (2024-2025), we need to estimate medical director income
  if ('employeePayroll' in yearData) {
    // Historic year - use actual values based on year
    const medicalDirectorIncome = yearData.year === 2024 ? ACTUAL_2024_MEDICAL_DIRECTOR_HOURS : ACTUAL_2025_MEDICAL_DIRECTOR_HOURS // 2024 vs 2025 actual shared MD income
    const prcsMedicalDirectorIncome = yearData.year === 2024 ? ACTUAL_2024_PRCS_MEDICAL_DIRECTOR_HOURS : ACTUAL_2025_PRCS_MEDICAL_DIRECTOR_HOURS // 2024 vs 2025 actual PRCS MD income
    // Add consulting services agreement based on year
    const consultingServicesIncome = yearData.year === 2024 ? DEFAULT_CONSULTING_SERVICES_2024 :
                                   yearData.year === 2025 ? DEFAULT_CONSULTING_SERVICES_2025 : DEFAULT_CONSULTING_SERVICES_PROJECTION
    return therapyIncome + medicalDirectorIncome + prcsMedicalDirectorIncome + consultingServicesIncome
  }
  
  // For future years, calculate from stored values
  const futureYear = yearData as FutureYear
  const medicalDirectorIncome = futureYear.medicalDirectorHours ?? DEFAULT_MD_SHARED_PROJECTION
  const prcsMedicalDirectorIncome = futureYear.prcsDirectorPhysicianId ? (futureYear.prcsMedicalDirectorHours ?? DEFAULT_MD_PRCS_PROJECTION) : 0
  const consultingServicesIncome = futureYear.consultingServicesAgreement ?? DEFAULT_CONSULTING_SERVICES_PROJECTION
  
  return therapyIncome + medicalDirectorIncome + prcsMedicalDirectorIncome + consultingServicesIncome
}

// Calculate guaranteed payments (buyout costs) from retiring partners for 2025 projected values
export function calculateGuaranteedPayments(physicians: Physician[]): number {
  const totalBuyoutCosts = physicians.reduce((sum, p) => {
    if (p.type === 'partnerToRetire') {
      // Only include buyout costs from retiring partners
      return sum + (p.buyoutCost ?? 0)
    }
    return sum
  }, 0)

  return Math.round(totalBuyoutCosts)
}

// Calculate locums salary from physician panel locum costs for 2025 projected values
export function calculateLocumsSalary(locumCosts: number): number {
  return Math.round(locumCosts)
}

// Aggregate MD Associates costs from employee/part-employee physicians for 2025 projected values
export function calculateMDAssociatesCosts(physicians: Physician[], year: number = 2025, benefitGrowthPct: number = 5.0): {
  totalSalary: number;
  totalBenefits: number;
  totalPayrollTaxes: number;
} {
  let totalSalary = 0
  let totalBenefits = 0
  let totalPayrollTaxes = 0

  // Filter for employees and part-employees who contribute to MD Associates costs
  const relevantPhysicians = physicians.filter(p => 
    p.type === 'employee' || 
    p.type === 'employeeToPartner' || 
    p.type === 'newEmployee' || 
    p.type === 'employeeToTerminate'
  )

  for (const physician of relevantPhysicians) {
    const employeePortion = getEmployeePortionOfYear(physician)
    if (employeePortion <= 0) continue

    let salary = physician.salary || 0
    let benefits = 0
    let payrollTaxes = 0

    // Calculate prorated costs for partial-year employees
    if (physician.type === 'newEmployee' || physician.type === 'employeeToTerminate') {
      salary *= employeePortion
    } else if (physician.type === 'employeeToPartner') {
      // For mixed types, only count the employee portion
      salary *= employeePortion
    }

    // Calculate benefits if physician receives them
    if (physician.receivesBenefits) {
      const yearlyBenefitCost = getBenefitCostsForYear(year, benefitGrowthPct)
      
      if (physician.type === 'newEmployee') {
        const startDay = startPortionToStartDay(physician.startPortionOfYear ?? 0, year)
        const benefitStartDay = calculateBenefitStartDay(startDay, year)
        const totalDays = daysInYear(year)
        
        if (benefitStartDay <= totalDays) {
          const benefitDays = Math.max(0, totalDays - benefitStartDay + 1)
          const benefitPortion = benefitDays / totalDays
          benefits = yearlyBenefitCost * benefitPortion
        }
      } else {
        benefits = yearlyBenefitCost
        
        // For mixed types, prorate benefits by employee portion
        if (physician.type === 'employeeToPartner') {
          benefits *= employeePortion
        }
      }
    }

    // Calculate employer payroll taxes on the salary amount
    payrollTaxes = calculateEmployerPayrollTaxes(salary, year)

    // Add delayed W2 payments for employeeToPartner physicians
    if (physician.type === 'employeeToPartner') {
      const delayedW2 = calculateDelayedW2Payment(physician, year)
      totalSalary += delayedW2.amount  // Add delayed W2 amount to salary total
      totalPayrollTaxes += delayedW2.taxes  // Add delayed W2 taxes to payroll taxes total
    }

    totalSalary += salary
    totalBenefits += benefits
    totalPayrollTaxes += payrollTaxes
  }

  return {
    totalSalary: Math.round(totalSalary),
    totalBenefits: Math.round(totalBenefits),
    totalPayrollTaxes: Math.round(totalPayrollTaxes)
  }
}

// Helper function to calculate even medical director hour percentages among partners
export function calculateMedicalDirectorHourPercentages(physicians: Physician[]): Physician[] {
  // Calculate total partner work time (sum of partner portions, ignoring vacation as requested)
  const totalPartnerPortions = physicians.reduce((sum, physician) => {
    return sum + getPartnerPortionOfYear(physician)
  }, 0)
  
  // If no partners, return physicians as-is
  if (totalPartnerPortions === 0) {
    return physicians.map(p => ({
      ...p,
      medicalDirectorHoursPercentage: 0,
      hasMedicalDirectorHours: false
    }))
  }
  
  // Distribute percentages evenly among partners based on their portion of year
  return physicians.map(physician => {
    const partnerPortion = getPartnerPortionOfYear(physician)
    const percentage = partnerPortion > 0 ? (partnerPortion / totalPartnerPortions) * 100 : 0
    
    return {
      ...physician,
      medicalDirectorHoursPercentage: percentage,
      hasMedicalDirectorHours: percentage > 0
    }
  })
}