// Helper function to generate tick configuration based on timeframe
export const getTickConfiguration = (
  timeframe: 'year' | 'quarter' | 'month',
  currentPeriod?: { year: number, quarter?: number, month?: number },
  isMobile?: boolean
) => {
  if (timeframe === 'year') {
    // In mobile mode, show fewer labels to avoid crowding: Jan, Apr, Jul, Oct, Dec 31
    if (isMobile) {
      return {
        tickvals: ['01-01', '04-01', '07-01', '10-01', '12-31'],
        ticktext: ['Jan', 'Apr', 'Jul', 'Oct', 'Dec 31']
      }
    }
    return {
      tickvals: ['01-01', '02-01', '03-01', '04-01', '05-01', '06-01', '07-01', '08-01', '09-01', '10-01', '11-01', '12-01', '12-31'],
      ticktext: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Dec 31']
    }
  } else if (timeframe === 'quarter' && currentPeriod?.quarter) {
    // For quarter view: show 1st, 15th of each month in quarter, plus last day of quarter
    const startMonth = (currentPeriod.quarter - 1) * 3 + 1
    const endMonth = startMonth + 2
    const tickvals: string[] = []
    const ticktext: string[] = []
    
    // Add 1st and 15th of each month in the quarter
    for (let month = startMonth; month <= endMonth; month++) {
      const monthStr = month.toString().padStart(2, '0')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthName = monthNames[month - 1]
      
      tickvals.push(`${monthStr}-01`)
      ticktext.push(`${monthName} 1`)
      
      tickvals.push(`${monthStr}-15`)
      ticktext.push(`${monthName} 15`)
    }
    
    // Add last day of quarter
    const lastMonth = endMonth
    const lastMonthStr = lastMonth.toString().padStart(2, '0')
    const lastMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const lastMonthName = lastMonthNames[lastMonth - 1]
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    const lastDay = daysInMonth[lastMonth - 1]
    
    tickvals.push(`${lastMonthStr}-${lastDay.toString().padStart(2, '0')}`)
    ticktext.push(`${lastMonthName} ${lastDay}`)
    
    return { tickvals, ticktext }
  } else if (timeframe === 'month' && currentPeriod?.month) {
    // For month view: show several days throughout the month
    const monthStr = currentPeriod.month.toString().padStart(2, '0')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthName = monthNames[currentPeriod.month - 1]
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    const lastDay = daysInMonth[currentPeriod.month - 1]
    
    return {
      tickvals: [`${monthStr}-01`, `${monthStr}-08`, `${monthStr}-15`, `${monthStr}-22`, `${monthStr}-${lastDay.toString().padStart(2, '0')}`],
      ticktext: [`${monthName} 1`, `${monthName} 8`, `${monthName} 15`, `${monthName} 22`, `${monthName} ${lastDay}`]
    }
  }
  
  // Default fallback
  return {
    tickvals: ['01-01', '02-01', '03-01', '04-01', '05-01', '06-01', '07-01', '08-01', '09-01', '10-01', '11-01', '12-01', '12-31'],
    ticktext: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Dec 31']
  }
}
