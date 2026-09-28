// Filters for /log. The page works without this script; it only hides rows and updates the summary line.
(function () {
  var form = document.getElementById('filters');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.lg-row'));
  var sum = document.getElementById('log-sum');
  var empty = document.getElementById('log-empty');
  var chip = document.getElementById('week-chip');
  var inputs = Array.prototype.slice.call(form.querySelectorAll('[data-filter]'));
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function fmtU(x) {
    return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2) + 'u';
  }
  function cls(x) {
    return x > 0 ? 'pos' : x < 0 ? 'neg' : 'flat';
  }
  function weekText(monday) {
    var a = new Date(monday + 'T00:00:00Z');
    var b = new Date(a.getTime() + 6 * 864e5);
    return MON[a.getUTCMonth()] + ' ' + a.getUTCDate() + ' – ' + MON[b.getUTCMonth()] + ' ' + b.getUTCDate();
  }

  function apply(push) {
    var f = {};
    inputs.forEach(function (i) { if (i.value) f[i.name] = i.value; });
    var n = 0, w = 0, l = 0, p = 0, pl = 0, staked = 0;
    rows.forEach(function (r) {
      var ok = Object.keys(f).every(function (k) { return r.dataset[k] === f[k]; });
      r.hidden = !ok;
      if (!ok) return;
      n++;
      var res = r.dataset.result;
      if (res === 'win') w++;
      if (res === 'loss') l++;
      if (res === 'push') p++;
      if (res === 'win' || res === 'loss') staked += +r.dataset.stake;
      pl += +r.dataset.pl;
    });
    pl = Math.round(pl * 100) / 100;
    var roi = staked ? (pl / staked) * 100 : null;
    sum.innerHTML = n + ' bet' + (n === 1 ? '' : 's') + ' · ' + w + '-' + l + (p ? '-' + p : '') +
      ' · <b class="' + cls(pl) + '">' + fmtU(pl) + '</b> · ROI ' +
      (roi == null ? '—' : (roi > 0 ? '+' : roi < 0 ? '−' : '') + Math.abs(roi).toFixed(1) + '%');
    empty.hidden = n > 0;
    chip.hidden = !f.week;
    if (f.week) document.getElementById('week-chip-label').textContent = weekText(f.week);
    if (push) {
      var q = new URLSearchParams(f).toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    }
  }

  var params = new URLSearchParams(location.search);
  inputs.forEach(function (i) {
    var v = params.get(i.name);
    if (v && (i.type === 'hidden' || i.querySelector('option[value="' + CSS.escape(v) + '"]'))) i.value = v;
    i.addEventListener('change', function () { apply(true); });
  });
  document.getElementById('week-clear').addEventListener('click', function () {
    form.querySelector('[name=week]').value = '';
    apply(true);
  });
  apply(false);
})();
