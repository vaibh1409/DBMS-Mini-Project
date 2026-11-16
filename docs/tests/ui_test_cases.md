# Web Interface Test Cases

The interface was tested in Chromium (automated with Playwright during development) against the seeded database, with the app running via `npm run dev`. Every case below passed, with no errors in the browser console.

Screenshots of the pages are in [`docs/screenshots/`](../screenshots/).

## Page checks

| ID | Check | Roles | Result |
|----|-------|-------|--------|
| P1 | Every page loads without a browser error: Today, Cattle, two animal pages, Milk yield, Breeding, Health records, Similar cases, Vaccinations (9 pages) at laptop width (1366 × 900) and phone width (390 × 844) | Owner, Vet, Farmhand | Pass (54 page loads) |
| P2 | No page scrolls sideways at phone width | Owner, Vet, Farmhand | Pass |
| P3 | Opening a signed-in page without a session redirects to the sign-in page | none | Pass |
| P4 | The menu shows only the pages the role can use (Farmhand: Today, Cattle, Milk yield) | all | Pass |

## Sign-in and roles

| ID | Role | Steps | Expected | Result |
|----|------|-------|----------|--------|
| U1 | – | Sign in as `vet_demo` with a wrong password | "Wrong username or password", no sign-in | Pass |
| U2 | Farmhand | Open `/health` | "Not available: this page is for Owner and Vet accounts" | Pass |

## Similar cases (vector search)

| ID | Role | Steps | Expected | Result |
|----|------|-------|----------|--------|
| U3 | Vet | Search "inflamed udder and lumpy discoloured milk" (similar meaning) | First result is a Mastitis case; likely conditions list Mastitis first | Pass |
| U4 | Vet | Same search with "Compare both" | Exact words finds no note; similar meaning returns the mastitis cases | Pass |
| U5 | Vet | Show vector on the first result | 384 dimensions, length 1.00, condition and date shown (read) | Pass |
| U6 | Vet | Remove from search | Confirmation shown; the note is no longer returned by vector search; on Health records its "In search" column offers "Add to search" (delete) | Pass |
| U7 | Vet | On Health records, click "Add to search" for that record, then search again | "Back in similar-case search"; the note is returned by vector search again (create) | Pass |

## Health records

| ID | Role | Steps | Expected | Result |
|----|------|-------|----------|--------|
| U8 | Vet | Add an examination for Kamadhenu with notes, condition and severity | Saved and "added to similar-case search" (record and vector in one transaction) | Pass |
| U9 | Vet | Open the record, change the notes, save | "saved and its note re-embedded" (update) | Pass |
| U10 | Vet | Open the record, Delete, confirm | Record deleted; its vector removed with it (ON DELETE CASCADE) | Pass |

## Vaccinations

| ID | Role | Steps | Expected | Result |
|----|------|-------|----------|--------|
| U11 | Vet | From the due list, add Tulsi and Kalyani (BQ) and record | "Recorded BQ for 2 animals"; due dates filled by the trigger | Pass |

## Cattle, breeding and calving

| ID | Role | Steps | Expected | Result |
|----|------|-------|----------|--------|
| U12 | Owner | Add animal KA-6001 | "Added KA-6001 to the herd" | Pass |
| U13 | Owner | Add KA-6001 again | Refused: "This record already exists" (UNIQUE) | Pass |
| U14 | Owner | Record a breeding for the new cow | "Breeding recorded as pending" | Pass |
| U15 | Owner | Record its calving with a birth date before the breeding date | Refused with the trigger's message; no calf saved (procedure rolled back) | Pass |
| U16 | Owner | Record the calving with a correct date | "Calf KA-6002 added to the herd and the breeding marked as calved" | Pass |
| U17 | Owner | Delete Gauri (KA-2001), a parent in breeding records | Refused: record still in use (ON DELETE RESTRICT) | Pass |

## Milk yield

| ID | Role | Steps | Expected | Result |
|----|------|-------|----------|--------|
| U18 | Farmhand | Record 6.4 L for Meena, morning | "Recorded 6.4 L for Meena" | Pass |
| U19 | Farmhand | Record the same cow, date and session again | Refused: "This record already exists" (UNIQUE) | Pass |

## Displayed data checked against the database

| ID | Page | Expected | Result |
|----|------|----------|--------|
| D1 | Today (Owner, Vet) | Lakshmi listed with milk down 45% and her latest exam (Mastitis); overdue and due-today vaccinations listed | Pass |
| D2 | Animal page, Tulsi (KA-4001) | Pedigree: parents Arjuna and Radha, grandparents Veera and Gauri, great-grandparents Bhima and Ganga; unknown ancestors shown as "Not recorded" | Pass |
| D3 | Animal page, Lakshmi (KA-2003) | Last 4 days of milk shown in red (more than 20% below her average) | Pass |
