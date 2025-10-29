/**
 * QuickBooks Retirement Account Utilities for Local Server
 */

// Physician name mapping
const KNOWN_PHYSICIANS = ['Connor', 'Allen', 'Suszko']

/**
 * Fetch equity accounts and identify retirement contribution accounts for known physicians
 * Pattern: "xxxx Retirement Contributions - NAME" where xxxx is 4 digits
 */
export async function fetchEquityAccounts(accessToken, realmId, baseUrl) {
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

  const data = await response.json()
  const accounts = {}

  // Pattern: "Retirement Contributions" (with optional "- NAME" suffix)
  // We match accounts that contain "Retirement Contribution" in the last segment
  const retirementPattern = /Retirement Contribution/i

  for (const account of data.QueryResponse?.Account || []) {
    const fqn = account.FullyQualifiedName
    const accountName = fqn.split(':').pop() || fqn

    // Check if this is a retirement account
    if (retirementPattern.test(accountName)) {
      // Try to extract physician name from the account name or parent path
      let physicianName = null

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
 */
export async function fetchGeneralLedgerForAccount(
  accessToken,
  realmId,
  baseUrl,
  accountId,
  startDate,
  endDate
) {
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

  const data = await response.json()
  let allNonPositive = 0
  let excludingJournals = 0

  const rows = data.Rows?.Row?.[0]?.Rows?.Row?.[0]?.Rows?.Row?.[0]?.Rows?.Row || []

  for (const row of rows) {
    if (row.type === 'Data' && row.ColData) {
      const txnType = row.ColData[0]?.value || ''
      const memo = row.ColData[1]?.value || ''
      const accountName = row.ColData[2]?.value || ''
      const amountStr = row.ColData[3]?.value || '0'
      const amount = parseFloat(amountStr.replace(/,/g, ''))

      if (amount <= 0) {
        allNonPositive += amount
        if (txnType !== 'Journal Entry') {
          excludingJournals += amount
        }
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
