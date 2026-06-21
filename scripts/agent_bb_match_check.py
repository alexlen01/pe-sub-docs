"""Throwaway analysis helper: replicate pe-sub-extraction HeaderMatcher
(normalize + Jaro-Winkler, MIN_CONFIDENCE 0.95) and test the 19 Agent_BB.xlsx
headers against the UI and prototype alias dictionaries."""
import re

def normalize(s):
    s = s.lower()
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def jaro(a, b):
    if a == b:
        return 1.0
    la, lb = len(a), len(b)
    if la == 0 or lb == 0:
        return 0.0
    win = max(la, lb) // 2 - 1
    if win < 0:
        win = 0
    ma = [False] * la
    mb = [False] * lb
    m = 0
    for i in range(la):
        lo = max(0, i - win)
        hi = min(i + win, lb - 1)
        for j in range(lo, hi + 1):
            if not mb[j] and a[i] == b[j]:
                ma[i] = mb[j] = True
                m += 1
                break
    if m == 0:
        return 0.0
    t = 0
    k = 0
    for i in range(la):
        if not ma[i]:
            continue
        while not mb[k]:
            k += 1
        if a[i] != b[k]:
            t += 1
        k += 1
    jv = (m / la + m / lb + (m - t // 2) / m) / 3.0
    pre = 0
    lim = min(4, min(la, lb))
    for i in range(lim):
        if a[i] == b[i]:
            pre += 1
        else:
            break
    return jv + pre * 0.1 * (1.0 - jv)

def best(header, dic):
    n = normalize(header)
    bc, bf, ba = 0.0, None, None
    for canon, aliases in dic.items():
        for al in aliases:
            na = normalize(al)
            s = 1.0 if n == na else jaro(n, na)
            if s > bc:
                bc, bf, ba = s, canon, al
    return bf, ba, bc

UI = {
    'Investor Name': ['Investor Name', 'Investor Name (Agent Records)', 'Investor', 'LP Name', 'Limited Partner', 'Fund Investor'],
    'Investor Type': ['LP Type', 'Investor Type', 'Classification', 'Category', 'Investor Category', 'LP Classification', 'Entity Type', 'Investor Class'],
    'Transferee': ['Transferee', 'Transfer Flag', 'Assignee', 'Assignment Flag', 'Transferred LP'],
    'Parent / Sponsor': ['Parent / Sponsor', 'Parent', 'Sponsor', 'Parent Entity', 'Sponsoring Entity', 'Ultimate Parent', 'Parent Organization', 'Parent / Sponsor / Manager', 'Manager'],
    'Eligibility Flag': ['Eligibility', 'Eligible'],
    'Capital Commitments': ['Capital Commitments', 'Committed Capital', 'Original Commitment', 'Individual Original Commitment', 'Total Commitment', 'Commitment (USD)', 'Total Capital Commitments ($)'],
    '% of Capital Commitments': ['% of Capital Commitments', '% Commitment', 'Commitment Percentage', 'LP Commitment %'],
    'Called Capital': ['Called Capital', 'Drawn Capital', 'Funded Capital', 'Capital Drawn', 'Funded Commitment', 'Called Commitment'],
    'Recallable Distributions': ['Recallable Distributions', 'Recallable Capital'],
    'Uncalled Capital': ['Uncalled Capital', 'Unfunded Capital Commitment', 'Individual Unfunded Commitment', 'Unfunded Commitment', 'Remaining Callable Capital', 'Remaining Commitment', 'Uncalled Capital (USD)', 'Unfunded Capital Commitments ($)'],
    '% of Uncalled Capital': ['% of Uncalled Capital', '% Uncalled', 'Uncalled %', '% Unfunded', 'Uncalled Ratio', '% Total Unfunded Commitment'],
    '% of LP Called': ['% of LP Called', '% Called', 'Called Ratio', 'Draw Percentage', '% Funded'],
    'AUM': ['AUM', 'Assets Under Management', 'Net Assets', 'Net Assets (range)', 'Total AUM'],
    'NAV': ['NAV', 'Net Asset Value', 'Fund NAV', 'Total NAV'],
    'Pension Assets': ['Pension Assets', 'Pension Fund Assets', 'Pension Pool', 'ERISA Assets'],
    'Pension Funded %': ['Pension Funded %', 'Pension Funding Ratio', 'Funded Status', 'Pension Funded Ratio'],
    'Advance Rate': ['Advance Rate', 'Agent Advance Rate', 'Adv. Rate', 'Rate', 'Applicable Rate', 'Advance Rate (%)'],
    'Eligible Commitment': ['Eligible Commitment', 'Remaining Callable Capital Adjusted for Concentration Limit', 'Eligible Uncalled'],
    '% of Eligible Uncalled': ['% Eligible Unfunded Commitment', '% of Eligible Uncalled Capital', '% Eligible Uncalled'],
    '% of Borrowing Base': ['% of Borrowing Base', '% BB', 'BB Percentage'],
    'Borrowing Base': ['Borrowing Base', 'Agent Borrowing Base', 'Agent BB', 'Facility BB', 'Agent Base', 'BB Amount', 'Borrowing Base Contribution'],
    'Concentration Limit': ['Concentration Limit', 'Agent Concentration Limit', 'Conc. Limit', 'Excel Concentration', 'Max Concentration', 'Aggregate Concentration'],
    'Concentration (%)': ['Concentration (%)', 'Concentration %', 'LP Concentration'],
    'Excess Concentration': ['Excess Concentration', 'Conc. Overage', 'Concentration Excess'],
    'Excess Concentration (%)': ['Excess Concentration (%)', 'Excess Concentration %', '% Excess Concentration'],
    'S&P Rating': ['S&P', 'S&P Rating', 'S&P Credit Rating', 'S and P', "S & P's Rating", 'S & P'],
    "Moody's Rating": ["Moody's", "Moody's Rating", 'Moodys', 'Applicable Rating'],
    'Fitch Rating': ['Fitch', 'Fitch Rating', 'Fitch Credit Rating'],
    'S&P Numeric Score': ['S&P (numerical ratings scale, 0-9)'],
    "Moody's Numeric Score": ["Moody's (numerical ratings scale, 0-9)"],
    'Numeric Rating': ['Applicable Rating (numerical ratings scale, 0-9)'],
}

PROTO = {
    'Investor Name': ['Investor Name', 'Investor Name (Agent Records)', 'Investor', 'LP Name', 'Limited Partner', 'Fund Investor'],
    'Investor Type': ['LP Type', 'Investor Type', 'Classification', 'Category', 'Investor Category', 'LP Classification', 'Entity Type', 'Investor Class'],
    'Transferee': ['Transferee', 'Transfer Flag', 'Assignee', 'Assignment Flag', 'Transferred LP'],
    'Parent / Sponsor': ['Parent / Sponsor', 'Parent', 'Sponsor', 'Parent Entity', 'Sponsoring Entity', 'Ultimate Parent', 'Parent Organization'],
    'Capital Commitments': ['Capital Commitments', 'Committed Capital', 'Original Commitment', 'Individual Original Commitment', 'Total Commitment', 'Commitment (USD)', 'Total Capital Commitments ($)'],
    '% of Capital Commitments': ['% of Capital Commitments', '% Commitment', 'Commitment Percentage', 'LP Commitment %'],
    'Called Capital': ['Called Capital', 'Drawn Capital', 'Funded Capital', 'Capital Drawn', 'Funded Commitment', 'Called Commitment'],
    'Uncalled Capital': ['Uncalled Capital', 'Unfunded Capital Commitment', 'Individual Unfunded Commitment', 'Unfunded Commitment', 'Remaining Callable Capital', 'Remaining Commitment', 'Uncalled Capital (USD)', 'Unfunded Capital Commitments ($)'],
    '% of Uncalled Capital': ['% of Uncalled Capital', '% Uncalled', 'Uncalled %', '% Unfunded', 'Uncalled Ratio'],
    '% of LP Called': ['% of LP Called', '% Called', 'Called Ratio', 'Draw Percentage', '% Funded'],
    'AUM': ['AUM', 'Assets Under Management', 'Net Assets', 'Net Assets (range)', 'Total AUM'],
    'NAV': ['NAV', 'Net Asset Value', 'Fund NAV', 'Total NAV'],
    'Pension Assets': ['Pension Assets', 'Pension Fund Assets', 'Pension Pool', 'ERISA Assets'],
    'Pension Funded %': ['Pension Funded %', 'Pension Funding Ratio', 'Funded Status', 'Pension Funded Ratio'],
    'Advance Rate': ['Advance Rate', 'Agent Advance Rate', 'Adv. Rate', 'Rate', 'Applicable Rate', 'Advance Rate (%)'],
    'Borrowing Base': ['Agent Borrowing Base', 'Borrowing Base Contribution', 'Agent BB', 'Facility BB', 'Agent Base', 'BB Amount'],
    '% of Borrowing Base': ['% of Borrowing Base', '% of BB', 'BB %', 'BB Share'],
    'Concentration Limit': ['Concentration Limit', 'Agent Concentration Limit', 'Conc. Limit', 'Excel Concentration', 'Max Concentration', 'Aggregate Concentration'],
    'Concentration (%)': ['Concentration (%)', 'Concentration %', 'LP Concentration'],
    'Excess Concentration': ['Excess Concentration', 'Concentration Excess', 'Concentration Haircut', 'Excess Exposure'],
    'Excess Concentration (%)': ['Excess Concentration (%)', 'Excess Concentration %', '% Excess Concentration'],
    'S&P Rating': ['S&P', 'S&P Rating', 'S&P Credit Rating', 'S and P'],
    "Moody's Rating": ["Moody's", "Moody's Rating", 'Moodys', 'Applicable Rating'],
    'Fitch Rating': ['Fitch', 'Fitch Rating', 'Fitch Credit Rating'],
}

HEADERS = ['Investors', 'Investor Name', 'Vehicle', 'Borrower', 'Group Name', 'Investor Type',
           'Included in Calculation of Sponsor Commitment', 'Total Capital Commitments ($)',
           'Unfunded Capital Commitments ($)', 'Advance Rate (%)', 'Concentration (%)',
           'Concentration Limits (%)', 'Borrowing Base UCC After Concentration Limit ($)',
           'Aggregate Concentration Limit', 'Aggregate Concentration',
           'Borrowing Base UCC After Aggregate Concentration Limit ($)', 'Borrowing Base ($)',
           "Rating If Applicable (Moody's/S&P/Fitch)", 'Notes']

TH = 0.95
print(f"{'Col':<4}{'Agent_BB Header':<52}{'UI result':<46}{'Prototype result'}")
print('-' * 165)
for i, h in enumerate(HEADERS, 1):
    uf, ua, uc = best(h, UI)
    pf, pa, pc = best(h, PROTO)
    us = f"OK {uf} ({uc:.3f})" if uc >= TH else f"NO MATCH (best {uf} {uc:.3f})"
    ps = f"OK {pf} ({pc:.3f})" if pc >= TH else f"NO MATCH (best {pf} {pc:.3f})"
    col = chr(64 + i)
    print(f"{col:<4}{h[:50]:<52}{us:<46}{ps}")
