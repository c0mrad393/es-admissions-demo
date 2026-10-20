"""Build fictional OpenApply-style application PDFs for the demo (HTML -> Chrome PDF)."""
import html, json, subprocess, sys, pathlib

OUT = pathlib.Path(sys.argv[1])
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

SAMPLES = {
 "sample-georgian-school": {
  "name": ["Elene", "Kapanadze"], "id": "00006311", "status": "Submitted on 14 October, 2026",
  "dob": "3 March, 2014 (12y, 7m)", "gender": "Female", "grade": "Grade 7",
  "student": [("Surname","Kapanadze"),("First Name","Elene"),("Date of Birth","3 March, 2014 (12y, 7m)"),("Gender","Female"),
              ("Personal ID Number","00000000017"),("Passport Number","SAMPLE0017"),("Citizenship","Georgia"),
              ("Street Address 1","12 Sample Street, apt 4"),("Street Address 2",""),("City","Tbilisi"),("State",""),
              ("Country","Georgia"),("Postal Code","0179"),("Student’s Phone Number","+995 555 00 00 01"),
              ("Student’s E-mail Address","elene.k@example.com"),("Anticipated Grade of Entry","Grade 7"),("Enrollment Year","2027-2028"),
              ("Programmes","IB Programme"),("Which school does he/she move from?","Public School N 51, Tbilisi"),("Current Grade","6")],
  "parents": [
    [("Relationship to Applicant","Mother"),("Surname","Kapanadze"),("Name","Nino"),("Date of Birth","12 May, 1985"),
     ("Personal ID Number","00000000025"),("Passport Number",""),("Citizenship","Georgia"),("Street Address 1","12 Sample Street, apt 4"),
     ("Street Address 2",""),("City","Tbilisi"),("State",""),("Country","Georgia"),("Postal Code","0179"),
     ("Mobile Phone Number","+995 555 00 00 02"),("E-mail Address","nino.kapanadze@example.com")],
    [("Relationship to Applicant","Father"),("Surname","Kapanadze"),("Name","Giorgi"),("Date of Birth","9 January, 1983"),
     ("Personal ID Number","00000000033"),("Passport Number",""),("Citizenship","Georgia"),("Street Address 1","12 Sample Street, apt 4"),
     ("Street Address 2",""),("City","Tbilisi"),("State",""),("Country","Georgia"),("Postal Code","0179"),
     ("Mobile Phone Number","+995 555 00 00 03"),("E-mail Address","giorgi.kapanadze@example.com")]],
  "siblings": [("Surname","Kapanadze"),("Name","Luka"),("Grade","3")],
  "security": [("Relation with a Student","Mother"),("Surname","Kapanadze"),("Name","Nino"),("Cell Phone Number","+995 555 00 00 02")],
  "signature": "Nino Kapanadze on Oct 14, 2026",
  "docs": [("Parental Consent Form of Enrollment","consent_signed.pdf"),("Student’s Birth Certificate","birth_certificate.pdf"),
           ("Parent 1’s Passport","id_nino.pdf"),("Parent 2’s Passport","id_giorgi.pdf")],
 },
 "sample-foreign-school": {
  "name": ["Sofia", "Kovalenko"], "id": "00006318", "status": "Submitted on 16 October, 2026",
  "dob": "21 August, 2018 (8y, 2m)", "gender": "Female", "grade": "Grade 3",
  "student": [("Surname","Kovalenko"),("First Name","Sofia"),("Date of Birth","21 August, 2018 (8y, 2m)"),("Gender","Female"),
              ("Personal ID Number",""),("Passport Number","FX0000001"),("Citizenship","Ukraine"),
              ("Street Address 1","45 Example Avenue"),("Street Address 2",""),("City","Tbilisi"),("State",""),
              ("Country","Georgia"),("Postal Code",""),("Student’s Phone Number","+995 555 00 00"),
              ("Student’s E-mail Address",""),("Anticipated Grade of Entry","Grade 3"),("Enrollment Year","2027-2028"),
              ("Programmes","IB Programme"),("Which school does he/she move from?","Kyiv International School, Ukraine"),("Current Grade","2")],
  "parents": [
    [("Relationship to Applicant","Mother"),("Surname","Kovalenko"),("Name","Olena"),("Date of Birth","4 April, 1990"),
     ("Personal ID Number",""),("Passport Number","FX0000002"),("Citizenship","Ukraine"),("Street Address 1","45 Example Avenue"),
     ("Street Address 2",""),("City","Tbilisi"),("State",""),("Country","Georgia"),("Postal Code",""),
     ("Mobile Phone Number","+380 50 000 00 00"),("E-mail Address","olena.kovalenko@example")],
    [("Relationship to Applicant","Father"),("Surname","Kovalenko"),("Name","Andriy"),("Date of Birth","30 November, 1988"),
     ("Personal ID Number",""),("Passport Number","FX0000003"),("Citizenship","Ukraine"),("Street Address 1",""),
     ("Street Address 2",""),("City",""),("State",""),("Country",""),("Postal Code",""),
     ("Mobile Phone Number",""),("E-mail Address","andriy.k@example.com")]],
  "siblings": [("Surname",""),("Name",""),("Grade","")],
  "security": [("Relation with a Student","Mother"),("Surname","Kovalenko"),("Name","Olena"),("Cell Phone Number","+380 50 000 00 00")],
  "signature": "Olena Kovalenko on Oct 16, 2026",
  "docs": [("Parental Consent Form of Enrollment",""),("Student’s Birth Certificate","birth_certificate_ua.pdf"),
           ("Parent 1’s Passport","passport_olena.pdf"),("Parent 2’s Passport","")],
 },
}

CSS = """
@page { size: 595.28pt 841.89pt; margin: 70pt 0 50pt 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Open Sans', Arial, sans-serif; font-size: 11pt; color: #222; }
.hdr { position: fixed; top: -45pt; right: 30pt; font-size: 17.8pt; font-weight: 700; color: #333; }
.ftr { position: fixed; bottom: -32pt; left: 28pt; font-size: 9pt; color: #777; }
.top { position: relative; height: 150pt; padding-left: 17pt; }
.avatar { position: absolute; left: 17pt; top: 10pt; width: 72pt; height: 72pt; border-radius: 50%; background: #d9dee8; }
.nm { position: absolute; left: 105pt; top: 15pt; font-size: 21pt; font-weight: 700; line-height: 31pt; width: 260pt; }
.sub { position: absolute; left: 105pt; top: 92pt; line-height: 17pt; color: #444; }
.ids { position: absolute; left: 387pt; top: 25pt; font-size: 14pt; line-height: 22pt; }
.smp { position: absolute; left: 387pt; top: 110pt; font-size: 9pt; color: #b33; font-weight: 700; letter-spacing: .5pt; }
.st { position: absolute; left: 408pt; top: 70pt; font-size: 12pt; background: #e8f1ff; padding: 2pt 6pt; border-radius: 3pt; }
.title { margin: 0 17pt 14pt; padding: 6pt; font-size: 14pt; font-weight: 700; border-bottom: 1px solid #ccc; }
h2 { font-size: 12pt; font-weight: 700; margin: 10pt 17pt 10pt; }
h3 { font-size: 14.6pt; font-weight: 700; margin: 12pt 17pt 10pt; }
.grid { display: grid; grid-template-columns: 292pt 270pt; padding-left: 17pt; row-gap: 7.5pt; }
.f { break-inside: avoid; }
.l { font-weight: 700; line-height: 16.5pt; }
.v { line-height: 16.5pt; min-height: 16.5pt; }
.full { grid-column: 1 / span 2; }
.note { margin: 6pt 17pt; color: #555; font-size: 10pt; }
"""

def fields(pairs, pair_rows=True):
    out = []
    for lab, val in pairs:
        cls = "f"
        out.append(f'<div class="{cls}"><div class="l">{html.escape(lab)}</div><div class="v">{html.escape(val)}</div></div>')
    return out

def layout_student(pairs):
    # Mirror OpenApply's grid: some labels sit alone in the left column.
    alone = {"Citizenship"}
    cells = []
    for lab, val in pairs:
        cell = f'<div class="f"><div class="l">{html.escape(lab)}</div><div class="v">{html.escape(val)}</div></div>'
        if lab in alone:
            cells.append(cell); cells.append('<div></div>')
        else:
            cells.append(cell)
    return cells

def build(key, d):
    first, last = d["name"]
    parts = ['<div class="top"><div class="avatar"></div>',
             '<div class="smp">SAMPLE · fictional data</div>',
             f'<div class="nm">{first} {last}</div>',
             f'<div class="sub">{d["dob"].split(" (")[0]} •<br>{d["gender"]} • {d["grade"]}</div>',
             f'<div class="ids"><b>Applicant ID</b> &nbsp; {d["id"]}<br><b>Student ID</b></div>',
             f'<div class="st">{d["status"]}</div></div>',
             '<div class="title">IB Programme Application Form</div>',
             '<h2>Student Information</h2><h2>Student’s Name</h2>']
    s = d["student"]
    def pick(names): return [p for p in s if p[0] in names]
    parts.append('<div class="grid">' + "".join(layout_student(pick(["Surname","First Name","Date of Birth","Gender","Personal ID Number","Passport Number","Citizenship"]))) + '</div>')
    parts.append('<h2>Address</h2>')
    parts.append('<div class="grid">' + "".join(layout_student(pick(["Street Address 1","Street Address 2","City","State","Country","Postal Code","Student’s Phone Number","Student’s E-mail Address","Anticipated Grade of Entry","Enrollment Year"]))) + '</div>')
    parts.append('<div class="grid">' + "".join(layout_student(pick(["Programmes"]))) + '<div></div>' + "".join(layout_student(pick(["Which school does he/she move from?","Current Grade"]))) + '</div>')
    parts.append('<div style="break-before: page"></div><h2>Student’s Family</h2>')
    for i, p in enumerate(d["parents"]):
        parts.append(f'<h3>Parent/Guardian {"One" if i == 0 else "Two"}</h3>')
        rel = [p[0]]
        rest = p[1:]
        parts.append('<div class="grid">' + "".join(layout_student(rel)) + '<div></div>' + "".join(layout_student(rest[:6])) + '</div>')
        parts.append('<h2>Address (If different from child’s.)</h2>')
        parts.append('<div class="grid">' + "".join(layout_student(rest[6:12])) + "".join(layout_student([rest[12]])) + '<div></div>' + "".join(layout_student([rest[13]])) + '<div></div></div>')
        parts.append('<h2>Employment</h2>')
    parts.append('<h3>Other Children in European School</h3><h2>Are any of your children registered at “European School” other than the applicant?</h2>')
    parts.append('<div class="grid">' + "".join(layout_student(d["siblings"])) + '</div>')
    parts.append('<div style="break-before: page"></div><h2>Additional Information</h2><h3>Medical Information of the Student</h3>')
    med = [("Does she or he have any problems with health?","no"),("Does the child suffer from any kind of physical or a mental illness?","no"),
           ("Does your child have any special educational needs?","no"),("Does your child have any unique abilities?","no")]
    parts.append('<div class="grid">' + "".join(layout_student(med)) + '</div>')
    parts.append('<h3>Student’s Security</h3>')
    sec = d["security"]
    parts.append('<div class="grid">' + "".join(layout_student(sec[:1])) + '<div></div>' + "".join(layout_student(sec[1:3])) + "".join(layout_student(sec[3:]))
                 + f'<div class="f"><div class="l">Parent’s Signature</div><div class="v">{html.escape(d["signature"])}</div></div></div>')
    parts.append('<div style="break-before: page"></div><h3>Application</h3>')
    parts.append('<div class="grid">' + f'<div class="f"><div class="l">Please, enroll my child</div><div class="v">{first} {last}</div></div>'
                 + f'<div class="f"><div class="l">In “European School”</div><div class="v">{d["grade"]}</div></div>'
                 + f'<div class="f"><div class="l">Signature</div><div class="v">{html.escape(d["signature"])}</div></div><div></div>'
                 + "".join(layout_student(d["docs"])) + '</div>')
    parts.append('<p class="note">Fictional sample generated for a product demo. All names, numbers and addresses are invented.</p>')
    doc = ('<!doctype html><html><head><meta charset="utf-8">'
           '<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap" rel="stylesheet">'
           f'<style>{CSS}</style></head><body>' + "".join(parts) + '</body></html>')
    src = OUT / f"{key}.html"
    src.write_text(doc, encoding="utf-8")
    pdf = OUT / f"{key}.pdf"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=6000",
                    f"--user-data-dir={OUT}/.chrome", f"--print-to-pdf={pdf}", src.as_uri()],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    print(pdf, pdf.stat().st_size)

OUT.mkdir(parents=True, exist_ok=True)
for k, d in SAMPLES.items():
    build(k, d)
