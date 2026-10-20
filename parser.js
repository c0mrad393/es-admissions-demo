/* OpenApply application PDF parser.
 * Input: pages = [{ width, height, items: [{ str, x, y, w, h }] }] where y is the
 * top of the text box measured from the top of the page (PDF points).
 * Works on the text layer only: labels are recognised by OpenApply's faux-bold
 * (each label is drawn twice, 0.2pt apart) or by the known-label dictionary.
 */
(function (root) {
  'use strict';

  var norm = function (s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[‘’`]/g, "'")
      .replace(/[“”„]/g, '"')
      .replace(/\s+/g, ' ')
      .replace(/[?.:]+$/, '')
      .trim();
  };

  // Section markers: a bold line that switches the context for later labels.
  var MARKERS = {
    'student information': 'student',
    "student's family": 'parent1',
    'parent/guardian one': 'parent1',
    'parent/guardian two': 'parent2',
    'other children in european school': 'siblings',
    'additional information': 'medical',
    'medical information of the student': 'medical',
    "student's security": 'security',
    'application': 'application'
  };

  // Labels that exist on the form but carry no field of their own.
  var STRUCTURAL = [
    "student's name", 'address', "address (if different from child's.)", 'employment',
    'applicant id', 'student id', 'please, enroll my child', 'in "european school"',
    'are any of your children registered at "european school" other than the applicant',
    'application of a parent', 'legislation'
  ];

  // [key, contexts, english labels]
  var DEFS = [
    ['student.lastName', ['student'], ['surname']],
    ['student.firstName', ['student'], ['first name']],
    ['student.dob', ['student'], ['date of birth']],
    ['student.gender', ['student'], ['gender']],
    ['student.pid', ['student'], ['personal id number']],
    ['student.passport', ['student'], ['passport number']],
    ['student.citizenship', ['student'], ['citizenship']],
    ['student.addr1', ['student'], ['street address 1']],
    ['student.addr2', ['student'], ['street address 2']],
    ['student.city', ['student'], ['city']],
    ['student.state', ['student'], ['state']],
    ['student.country', ['student'], ['country']],
    ['student.postal', ['student'], ['postal code']],
    ['student.phone', ['student'], ["student's phone number"]],
    ['student.email', ['student'], ["student's e-mail address"]],
    ['app.grade', ['student'], ['anticipated grade of entry']],
    ['app.year', ['student'], ['enrollment year']],
    ['app.programme', ['student'], ['programmes', 'programme']],
    ['app.prevSchool', ['student'], ['which school does he/she move from']],
    ['app.currentGrade', ['student'], ['current grade']],
    ['medical.health', ['medical'], ['does she or he have any problems with health']],
    ['medical.mental', ['medical'], ['does the child suffer from any kind of physical or a mental illness']],
    ['medical.sen', ['medical'], ['does your child have any special educational needs']],
    ['medical.abilities', ['medical'], ['does your child have any unique abilities']],
    ['security.relation', ['security'], ['relation with a student']],
    ['security.lastName', ['security'], ['surname']],
    ['security.firstName', ['security'], ['name']],
    ['security.phone', ['security'], ['cell phone number']],
    ['sign.signature', ['security', 'application'], ["parent's signature", 'signature']],
    ['docs.consent', ['application'], ['parental consent form of enrollment']],
    ['docs.birth', ['application'], ["student's birth certificate"]],
    ['docs.p1passport', ['application'], ["parent 1's passport"]],
    ['docs.p2passport', ['application'], ["parent 2's passport"]],
    ['sibling.lastName', ['siblings'], ['surname']],
    ['sibling.firstName', ['siblings'], ['name']],
    ['sibling.grade', ['siblings'], ['grade']]
  ];
  ['parent1', 'parent2'].forEach(function (p) {
    DEFS.push(
      [p + '.relation', [p], ['relationship to applicant']],
      [p + '.lastName', [p], ['surname']],
      [p + '.firstName', [p], ['name']],
      [p + '.dob', [p], ['date of birth']],
      [p + '.pid', [p], ['personal id number']],
      [p + '.passport', [p], ['passport number']],
      [p + '.citizenship', [p], ['citizenship']],
      [p + '.addr1', [p], ['street address 1']],
      [p + '.addr2', [p], ['street address 2']],
      [p + '.city', [p], ['city']],
      [p + '.state', [p], ['state']],
      [p + '.country', [p], ['country']],
      [p + '.postal', [p], ['postal code']],
      [p + '.phone', [p], ['mobile phone number']],
      [p + '.email', [p], ['e-mail address']]
    );
  });

  var MULTILINE = { 'app.prevSchool': 1, 'student.addr1': 1, 'student.addr2': 1, 'parent1.addr1': 1, 'parent1.addr2': 1, 'parent2.addr1': 1, 'parent2.addr2': 1 };

  var KNOWN = {};
  Object.keys(MARKERS).forEach(function (k) { KNOWN[k] = 1; });
  STRUCTURAL.forEach(function (k) { KNOWN[k] = 1; });
  DEFS.forEach(function (d) { d[2].forEach(function (l) { KNOWN[l] = 1; }); });

  var FURNITURE = /^applicant profile$|\u2022\s*applicant profile|^sample \u00b7 fictional data|^\d+\s*of\s*\d+$/i;
  var BOILERPLATE = /strong password|uppercase and lowercase|^numbers \(0-9\)|^special characters|trash can below/i;
  var STATUS_RE = /^(submitted|declined|enrolled|accepted|admitted|withdrawn|wait ?listed|waitlisted|applied|offered|interviewed|pending|received|in progress|started|graduated)\b(?:\s+on\s+(.+))?$/i;

  function prepare(pages) {
    var all = [];
    pages.forEach(function (pg, pi) {
      var items = pg.items.filter(function (it) { return it.str && it.str.trim(); });
      // Faux-bold: the same string drawn twice, offset by < 1pt on the same baseline.
      var dropped = new Set();
      items.forEach(function (a, i) {
        items.forEach(function (b, j) {
          if (i === j || dropped.has(i) || dropped.has(j)) return;
          if (a.str === b.str && Math.abs(a.y - b.y) < 0.6 && b.x > a.x && b.x - a.x < 1.2) {
            a.bold = true; dropped.add(j);
          }
        });
      });
      // Some PDF writers split one line into several runs: join neighbours on a line.
      var kept = items.filter(function (_, i) { return !dropped.has(i); })
        .sort(function (a, b) { return a.y - b.y || a.x - b.x; });
      var joined = [];
      kept.forEach(function (it) {
        var prev = joined[joined.length - 1];
        if (prev && Math.abs(prev.y - it.y) < 1 && it.x < prev.x + prev.w - 1 && it.str.indexOf(prev.str) === 0) {
          joined[joined.length - 1] = Object.assign({}, it, { bold: prev.bold || it.bold }); return;
        }
        if (prev && Math.abs(prev.y - it.y) < 1 && !!prev.bold === !!it.bold && it.x - (prev.x + prev.w) < 4 && it.x >= prev.x + prev.w - 1) {
          var space = it.x - (prev.x + prev.w) > 0.8 && !/\s$/.test(prev.str) && !/^\s/.test(it.str) ? ' ' : '';
          prev.str += space + it.str; prev.w = it.x + it.w - prev.x; prev.h = Math.max(prev.h, it.h);
        } else joined.push(Object.assign({}, it));
      });
      items = joined; dropped = new Set();
      items.forEach(function (it, i) {
        if (dropped.has(i)) return;
        var t = it.str.replace(/\s+/g, ' ').trim();
        // Running header / footer of the OpenApply export.
        if (it.y < 70 || it.y > pg.height - 40) return;
        if (FURNITURE.test(t)) return;
        all.push({ str: t, n: norm(t), x: it.x, y: it.y, w: it.w, h: it.h, page: pi, bold: !!it.bold,
          col: it.x < pg.width * 0.47 ? 0 : 1, abs: pi * 10000 + it.y });
      });
    });
    var KNOWN_LIST = Object.keys(KNOWN);
    var isPrefix = function (n) { return n.length >= 18 && KNOWN_LIST.some(function (k) { return k.length > n.length && k.indexOf(n) === 0; }); };
    all.forEach(function (it) {
      it.label = it.bold || KNOWN[it.n] === 1 || isPrefix(it.n);
      if (BOILERPLATE.test(it.str)) it.junk = true;
    });
    all.sort(function (a, b) { return a.abs - b.abs || a.x - b.x; });

    // Merge labels that wrap onto a second line in the same column.
    var out = [];
    all.forEach(function (it) {
      var prevAny = null;
      for (var q = out.length - 1; q >= 0; q--) {
        if (out[q].page !== it.page) break;
        if (out[q].col === it.col) { prevAny = out[q]; break; }
      }
      if (prevAny && !it.label && prevAny.label && !KNOWN[prevAny.n] && prevAny.page === it.page && prevAny.col === it.col &&
          it.y - prevAny.y > 0 && it.y - prevAny.y <= 18) {
        var cand = norm(prevAny.str + ' ' + it.str);
        if (KNOWN[cand] || isPrefix(cand)) { it.label = true; }
      }
      if (it.label && !KNOWN[it.n]) {
        for (var k = out.length - 1; k >= 0; k--) {
          var prev = out[k];
          if (prev.page !== it.page) break;
          if (prev.col !== it.col) continue;
          if (prev.label && !KNOWN[prev.n] && it.y - prev.y > 0 && it.y - prev.y <= 18) {
            prev.str += ' ' + it.str; prev.n = norm(prev.str);
            prev.h = it.y + it.h - prev.y; prev.w = Math.max(prev.w, it.w);
            return;
          }
          break;
        }
      }
      out.push(it);
    });
    return out;
  }

  function valueFor(label, seq, idx) {
    var lines = [];
    var lastY = null;
    for (var i = idx + 1; i < seq.length; i++) {
      var it = seq[i];
      if (it.col !== label.col) continue;
      if (it.label) break;
      if (it.junk) break;
      var gap = it.page === (lastY ? lastY.page : label.page)
        ? it.y - (lastY ? lastY.y : label.y)
        : 30; // a page break: OpenApply continues the value at the top of the next page
      if (lines.length === 0 && gap > 45) break;
      if (lines.length > 0 && gap > 19) break;
      lines.push(it); lastY = it;
    }
    return lines;
  }

  function box(list) {
    if (!list.length) return null;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, p = list[0].page;
    list.forEach(function (it) {
      if (it.page !== p) return;
      x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y);
      x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + it.h);
    });
    return { page: p, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function parse(pages) {
    var seq = prepare(pages);
    var ctx = 'header';
    var fields = {};
    var meta = { applicantId: '', status: '', statusDate: '', formTitle: '' };
    var labelsSeen = 0, unknown = [];

    seq.forEach(function (it, i) {
      if (it.page === 0 && it.y < 300) {
        var m = it.str.match(STATUS_RE);
        if (m && !it.label) { meta.status = m[1]; meta.statusDate = m[2] || ''; meta.statusBox = box([it]); }
        if (/application form$/i.test(it.str) && !meta.formTitle) { meta.formTitle = it.str; }
        if (it.n === 'applicant id') {
          var same = seq.filter(function (o) { return o.page === 0 && Math.abs(o.y - it.y) < 2 && o.x > it.x + it.w - 1 && !o.label; });
          if (same.length) { meta.applicantId = same[0].str; meta.applicantIdBox = box([it, same[0]]); }
        }
      }
      if (!it.label) return;
      if (MARKERS[it.n]) { ctx = MARKERS[it.n]; return; }
      var def = null;
      for (var d = 0; d < DEFS.length; d++) {
        if (DEFS[d][1].indexOf(ctx) >= 0 && DEFS[d][2].indexOf(it.n) >= 0) { def = DEFS[d]; break; }
      }
      if (!def) { if (!KNOWN[it.n] && it.page > 0 || (!KNOWN[it.n] && it.y >= 245)) unknown.push(it.str); return; }
      var key = def[0];
      if (fields[key]) return; // first occurrence wins
      labelsSeen++;
      var vals = valueFor(it, seq, i);
      if (!MULTILINE[key]) vals = vals.slice(0, 1);
      fields[key] = {
        value: vals.map(function (v) { return v.str; }).join(MULTILINE[key] ? ', ' : ' ').replace(/\s+,/g, ',').trim(),
        label: it.str,
        box: box(vals) || null,
        labelBox: box([it])
      };
    });
    return { meta: meta, fields: fields, labelsSeen: labelsSeen, unknownLabels: unknown };
  }

  // ---------- normalisation & checks ----------
  var MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function parseDate(s) {
    s = String(s || '').replace(/\(.*?\)/g, '').trim();
    var m = s.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
    if (m && MONTHS[m[2].toLowerCase()]) return iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m && MONTHS[m[1].toLowerCase()]) return iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m) return iso(+m[3], +m[2], +m[1]);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return iso(+m[1], +m[2], +m[3]);
    return '';
  }
  function iso(y, mo, d) {
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }

  var GEO_HINTS = /georgia|georgian|tbilisi|batumi|kutaisi|rustavi|gori|zugdidi|telavi|poti|mtskheta|borjomi|saburtalo|vake|\bpublic school\b|\bschool\s*(n|no|#)\s*\d+|\b(n|no|#)\s*\d+\b|საჯარო|ქართ|თბილის|სკოლა/i;
  var FOREIGN_HINTS = /ukrain|kyiv|kiev|kharkiv|odesa|odessa|lviv|russia|moscow|st\.? petersburg|azerbaijan|baku|armenia|yerevan|turkey|türkiye|istanbul|ankara|iran|tehran|israel|tel aviv|kazakhstan|almaty|astana|uzbekistan|tashkent|belarus|minsk|poland|warsaw|germany|berlin|munich|france|paris|italy|rome|spain|madrid|united kingdom|\buk\b|london|usa|united states|new york|canada|toronto|dubai|uae|china|beijing|india|egypt|cairo|qatar|doha|netherlands|amsterdam|lyc[ée]e|gymnasium|gimnazium/i;

  function classifySchool(name, citizenship) {
    var s = String(name || '').trim();
    if (!s || /^(none|no|n\/a|-|kindergarten)$/i.test(s)) return { suggestion: 'none', reason: 'წინა სკოლა მითითებული არ არის', reasonEn: 'No previous school given' };
    var foreign = FOREIGN_HINTS.test(s), geo = GEO_HINTS.test(s);
    if (foreign && !geo) return { suggestion: 'foreign', reason: 'სკოლის სახელში უცხო ქვეყანა ან ქალაქია', reasonEn: 'The school name contains a foreign country or city' };
    if (geo && !foreign) return { suggestion: 'georgian', reason: 'სკოლის სახელში საქართველოსთან დაკავშირებული სიტყვაა', reasonEn: 'The school name points to Georgia' };
    var foreignCz = citizenship && !/georgia|საქართველო/i.test(citizenship);
    return { suggestion: 'unknown', reason: 'სახელიდან ქვეყანა ვერ დადგინდა' + (foreignCz ? ' · მოქალაქეობა: ' + citizenship : ''), reasonEn: 'The country is not clear from the name' + (foreignCz ? ' · citizenship: ' + citizenship : '') };
  }

  function gradeNumber(s) {
    var m = String(s || '').match(/(\d{1,2})/);
    if (m) return +m[1];
    if (/kinder|pre-?k|nursery/i.test(s)) return 0;
    return null;
  }
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  function programmeFor(formTitle, programme, grade) {
    var src = (formTitle || '') + ' ' + (programme || '');
    var g = gradeNumber(grade);
    if (/\bib\b|international baccalaureate/i.test(src)) {
      var sub = g == null ? 'IB' : g <= 5 ? 'IB PYP' : g <= 9 ? 'IB MYP' : 'IB DP';
      return { code: sub, label: sub, fee: 250, grade: g };
    }
    if (/cognia|asas|american/i.test(src)) return { code: 'Cognia', label: 'Cognia (ASAS)', fee: 250, grade: g };
    if (/kinder|ბაღ/i.test(src)) return { code: 'KG', label: 'საბავშვო ბაღი', fee: 100, grade: g };
    if (/georgian|ქართ/i.test(src)) return { code: 'GEO', label: 'ქართული პროგრამა', fee: 150, grade: g };
    return { code: '', label: 'დასაზუსტებელი', fee: null, grade: g };
  }

  var api = { parse: parse, prepare: prepare, parseDate: parseDate, digits: digits, classifySchool: classifySchool,
    programmeFor: programmeFor, gradeNumber: gradeNumber, ROMAN: ROMAN, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OAParser = api;
})(this);
