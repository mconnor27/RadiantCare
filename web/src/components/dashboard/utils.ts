// Currency formatters
export function currency(value: number): string {
  // Handle undefined/null values gracefully
  if (value == null || isNaN(value)) {
    value = 0
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

// Currency formatter that shows dash for zero values (for tables)
export function currencyOrDash(value: number): string {
  // Handle undefined/null values gracefully
  if (value == null || isNaN(value) || value === 0) {
    return '-'
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

// Abbreviated currency for compact displays (e.g., $525k)
export function currencyShort(value: number): string {
  const thousands = Math.round(value / 1000)
  return `$${thousands}k`
}

// Helper to clamp values between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Date and calendar helpers
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

export function dayOfYearToDate(dayOfYear: number, year: number): { month: number, day: number } {
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let remainingDays = dayOfYear
  let month = 0
  
  while (remainingDays > daysInMonth[month]) {
    remainingDays -= daysInMonth[month]
    month++
  }
  
  return { month: month + 1, day: remainingDays }
}

export function calendarDateToPortion(month: number, day: number, year: number): number {
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let dayOfYear = 0
  
  // Add days for all complete months before the target month
  for (let i = 0; i < month - 1; i++) {
    dayOfYear += daysInMonth[i]
  }
  
  // Add the day within the target month
  dayOfYear += day
  
  // Convert to portion of year (0 to 1)
  const totalDays = daysInYear(year)
  return (dayOfYear - 1) / totalDays
}

export function dateToString(month: number, day: number): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[month - 1]} ${day}`
}

export function employeePortionToTransitionDay(employeePortionOfYear: number, year: number): number {
  const totalDays = daysInYear(year)
  // If employeePortionOfYear is 0, they transition on Jan 1 (day 1)
  // If employeePortionOfYear is 1, they transition on Jan 1 of next year (day = totalDays + 1)
  return Math.max(1, Math.round(employeePortionOfYear * totalDays) + 1)
}

export function transitionDayToEmployeePortion(transitionDay: number, year: number): number {
  const totalDays = daysInYear(year)
  // Day 1 means transition on Jan 1 (0% employee time - partner from day 1)
  // Day N means they were employee for (N-1) days, then partner from day N onward
  return Math.max(0, (transitionDay - 1) / totalDays)
}

// Helper for retirement portion - day 0 means retired in prior year (0 working days), day 1+ means last day of work
export function retirementDayToPartnerPortion(retirementDay: number, year: number): number {
  const totalDays = daysInYear(year)
  if (retirementDay === 0) {
    // Day 0 means retired in prior year - 0 working days in current year
    return 0
  }
  return retirementDay / totalDays
}

export function partnerPortionToRetirementDay(partnerPortionOfYear: number, year: number): number {
  const totalDays = daysInYear(year)
  if (partnerPortionOfYear === 0) {
    // 0 working portion means day 0 (retired in prior year)
    return 0
  }
  return Math.round(partnerPortionOfYear * totalDays)
}

// Helper for new employee start date - similar to transition day but for start of employment
export function startPortionToStartDay(startPortionOfYear: number, year: number): number {
  const totalDays = daysInYear(year)
  // startPortionOfYear 0 means Jan 1 (day 1), 1 means Dec 31 (last day)
  return Math.max(1, Math.round(startPortionOfYear * totalDays) + 1)
}

export function startDayToStartPortion(startDay: number, year: number): number {
  const totalDays = daysInYear(year)
  // Day 1 means start on Jan 1 (0% through year), last day means start near end
  return Math.max(0, Math.min(1, (startDay - 1) / totalDays))
}

// Helper function to get quarter start days for a given year (Apr 1, Jul 1, Oct 1)
export function getQuarterStartDays(year: number): { q2: number; q3: number; q4: number } {
  const isLeap = isLeapYear(year)
  const q2 = 31 + (isLeap ? 29 : 28) + 31 + 1 // Apr 1
  const q3 = 31 + (isLeap ? 29 : 28) + 31 + 30 + 31 + 30 + 1 // Jul 1
  const q4 = 31 + (isLeap ? 29 : 28) + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 1 // Oct 1
  return { q2, q3, q4 }
}

// Helper function to abbreviate physician names for summary display
export function abbreviatePhysicianName(name: string): string {
  // Check if it's a default "Physician X" format
  if (/^Physician\s+\d+$/i.test(name.trim())) {
    return '??'
  }
  
  // If name is 2 characters or less, return as-is
  if (name.trim().length <= 2) {
    return name.trim()
  }
  
  // Split by spaces and take first letter of first two words
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    const firstInitial = words[0].charAt(0).toUpperCase()
    const secondInitial = words[1].charAt(0).toUpperCase()
    return firstInitial + secondInitial
  } else if (words.length === 1) {
    // If only one word, take first two characters
    return words[0].substring(0, 2).toUpperCase()
  }
  
  return name.trim()
}

// Date manipulation helpers
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Calculate when benefits start for a new employee based on the new waiting period rules
export function calculateBenefitStartDay(startDay: number, year: number): number {
  const { month: startMonth, day: startDayOfMonth } = dayOfYearToDate(startDay, year)
  
  // Rule: If start date is the first of any month (except February), benefits start next month
  if (startDayOfMonth === 1 && startMonth !== 2) {
    // Benefits start on the first of the next month
    const nextMonth = startMonth === 12 ? 1 : startMonth + 1
    const nextYear = startMonth === 12 ? year + 1 : year
    
    if (nextYear > year) {
      // If it rolls to next year, benefits start after this year ends
      return daysInYear(year) + 1
    }
    
    // Calculate day of year for first of next month
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    let dayOfYear = 0
    for (let i = 0; i < nextMonth - 1; i++) {
      dayOfYear += daysInMonth[i]
    }
    return dayOfYear + 1
  }
  
  // Rule: If start is mid-month (or Feb 1st), benefits start one month PLUS rounding up to next month start
  // This means: 30 days + beginning of first full month after that
  const thirtyDaysAfterStart = startDay + 30
  
  if (thirtyDaysAfterStart > daysInYear(year)) {
    // If 30 days after start goes into next year, benefits start after this year
    return daysInYear(year) + 1
  }
  
  // Find what month the 30-day mark falls in
  const { month: month30Days } = dayOfYearToDate(thirtyDaysAfterStart, year)
  
  // Benefits start on the first of the month AFTER the 30-day mark
  const benefitMonth = month30Days === 12 ? 1 : month30Days + 1
  const benefitYear = month30Days === 12 ? year + 1 : year
  
  if (benefitYear > year) {
    // If benefits start next year, return beyond this year
    return daysInYear(year) + 1
  }
  
  // Calculate day of year for first of benefit month
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let dayOfYear = 0
  for (let i = 0; i < benefitMonth - 1; i++) {
    dayOfYear += daysInMonth[i]
  }
  return dayOfYear + 1
}

// Bi-weekly payroll schedule calculations
// Reference: 12/20/2024 pay date for period 11/30/2024-12/13/2024
const REFERENCE_PAY_DATE = new Date('2024-12-20')
const REFERENCE_PERIOD_END = new Date('2024-12-13')

export function getPayPeriodsForYear(year: number): Array<{ periodStart: Date; periodEnd: Date; payDate: Date }> {
  const periods: Array<{ periodStart: Date; periodEnd: Date; payDate: Date }> = []
  
  // Start from reference point and work backwards to find the first period of the year
  let currentPeriodEnd = new Date(REFERENCE_PERIOD_END)
  let currentPayDate = new Date(REFERENCE_PAY_DATE)
  
  // Go back to find the first pay period of the target year
  while (currentPeriodEnd.getFullYear() > year || 
         (currentPeriodEnd.getFullYear() === year && currentPeriodEnd.getMonth() > 0) ||
         (currentPeriodEnd.getFullYear() === year && currentPeriodEnd.getMonth() === 0 && currentPeriodEnd.getDate() > 14)) {
    currentPeriodEnd = addDays(currentPeriodEnd, -14)
    currentPayDate = addDays(currentPayDate, -14)
  }
  
  // Now work forward to collect all periods that could affect the target year
  const nextYearEnd = new Date(year + 1, 0, 31) // Include early next year for delayed payments
  
  while (currentPayDate <= nextYearEnd) {
    const periodStart = addDays(currentPeriodEnd, -13) // 14-day period
    
    periods.push({
      periodStart,
      periodEnd: new Date(currentPeriodEnd),
      payDate: new Date(currentPayDate)
    })
    
    // Move to next bi-weekly period
    currentPeriodEnd = addDays(currentPeriodEnd, 14)
    currentPayDate = addDays(currentPayDate, 14)
  }
  
  return periods
}