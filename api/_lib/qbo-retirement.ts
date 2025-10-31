/**
 * QuickBooks Retirement Account Utilities
 *
 * This module handles fetching and parsing retirement contribution data from QuickBooks.
 * It queries the General Ledger to get detailed transaction data instead of just balance sheet totals.
 */

export interface RetirementAccount {
  accountId: string
  accountName: string
}

export interface RetirementTransaction {
  transactionType: string
  memo: string
  amount: number
  date?: string
}

export interface RetirementTotals {
  allNonPositive: number      // Sum of all non-positive transactions (display value)
  excludingJournals: number   // Sum excluding Journal Entry transactions (for accrued tooltip)
}

export interface RetirementGLData {
  accountId: string
  transactions: any[]  // Raw GL rows from QuickBooks
  totals: RetirementTotals
}

// Physician name mapping from PARTNER_COMPENSATION_CONFIG
const KNOWN_PHYSICIANS = ['Connor', 'Allen', 'Suszko']

/**
 * Fetch equity accounts and identify retirement contribution accounts for known physicians
 *
 * Pattern: "xxxx Retirement Contributions - NAME" where xxxx is 4 digits
 * Example: "3920 Retirement Contributions - Suszko"
 */
export async function fetchEquityAccounts(
  accessToken: string,
  realmId: string,
  baseUrl: string
): Promise<Record<string, RetirementAccount>> {
  // Step 1: Query all equity accounts from QuickBooks
  const queryUrl = `${baseUrl}/v3/company/${encodeURIComponent(realmId)}/query?query=select id,FullyQualifiedName from Account where AccountType = 'Equity'&minorversion=75`

  const response = await fetch(queryUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('Failed to fetch equity accounts:', response.status, text)
    throw new Error('Failed to fetch equity accounts')
  }

  const data = await response.json() as { QueryResponse?: { Account?: any[] } }
  const accounts: Record<string, RetirementAccount> = {}

  // Pattern: "Retirement Contributions" (with optional "- NAME" suffix)
  // We match accounts that contain "Retirement Contribution" in the last segment
  const retirementPattern = /Retirement Contribution/i

  // Parse and match retirement accounts
  for (const account of data.QueryResponse?.Account || []) {
    const fqn = account.FullyQualifiedName
    const accountName = fqn.split(':').pop() || fqn

    // Check if this is a retirement account
    if (retirementPattern.test(accountName)) {
      // Try to extract physician name from the account name or parent path
      let physicianName: string | null = null

      // Method 1: Extract from parent path "Dr. NAME" or "Dr NAME" (most reliable)
      const parentMatch = fqn.match(/:Dr\.?\s+(\w+)/i)
      if (parentMatch) {
        physicianName = parentMatch[1].trim()
      }

      // Method 2: Extract from "Retirement Contributions - NAME" pattern (fallback)
      if (!physicianName) {
        const nameMatch = accountName.match(/Retirement Contributions?\s*-\s*(.+)$/i)
        if (nameMatch) {
          physicianName = nameMatch[1].trim()
        }
      }

      // Check if this physician is in our known list
      if (physicianName && KNOWN_PHYSICIANS.includes(physicianName)) {
        accounts[physicianName] = {
          accountId: account.Id,
          accountName: fqn
        }
        console.log(`Found retirement account for ${physicianName}: ${fqn} (ID: ${account.Id})`)
      }
    }
  }

  return accounts
}

/**
 * Fetch General Ledger data for a specific retirement account
 *
 * Calculates two totals:
 * 1. allNonPositive: Sum of all non-positive transactions (money paid out)
 * 2. excludingJournals: Same but excluding Journal Entry transactions (accrued amount)
 */
export async function fetchGeneralLedgerForAccount(
  accessToken: string,
  realmId: string,
  baseUrl: string,
  accountId: string,
  startDate: string,
  endDate: string
): Promise<RetirementGLData> {
  const url = new URL(`${baseUrl}/v3/company/${encodeURIComponent(realmId)}/reports/GeneralLedger`)
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set('columns', 'account_name,subt_nat_amount,memo,txn_type')
  url.searchParams.set('account', accountId)
  url.searchParams.set('minorversion', '75')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`Failed to fetch GL for account ${accountId}:`, response.status, text)
    throw new Error(`Failed to fetch General Ledger for account ${accountId}`)
  }

  const data = await response.json() as { Rows?: { Row?: any[] } }

  // Parse transactions and calculate totals
  const transactions: RetirementTransaction[] = []
  let allNonPositive = 0
  let excludingJournals = 0

  // Navigate the nested Row structure (based on test_general.json structure)
  // The GL report has nested Row arrays: Rows > Row > Rows > Row > Rows > Row > Rows > Row (data rows)
  const rows = data.Rows?.Row?.[0]?.Rows?.Row?.[0]?.Rows?.Row?.[0]?.Rows?.Row || []

  for (const row of rows) {
    if (row.type === 'Data' && row.ColData) {
      // Column structure: [txn_type, memo, account_name, subt_nat_amount]
      const txnType = row.ColData[0]?.value || ''
      const memo = row.ColData[1]?.value || ''
      const accountName = row.ColData[2]?.value || ''
      const amountStr = row.ColData[3]?.value || '0'

      // Parse amount (remove commas and convert to number)
      const amount = parseFloat(amountStr.replace(/,/g, ''))

      // Ignore positive values (money coming in - we only care about money paid out)
      if (amount <= 0) {
        allNonPositive += amount

        // Exclude Journal Entry transactions from accrued calculation
        if (txnType !== 'Journal Entry') {
          excludingJournals += amount
        }

        transactions.push({
          transactionType: txnType,
          memo,
          amount
        })
      }
    }
  }

  console.log(`GL totals for account ${accountId}: allNonPositive=${allNonPositive}, excludingJournals=${excludingJournals}`)

  return {
    accountId,
    transactions: rows,
    totals: {
      allNonPositive,
      excludingJournals
    }
  }
}
