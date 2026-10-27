// Work progress table: selecting a cell highlights every cell of its task(s), the Monitoring and Forecasting Centre and
// the data assimilation software it uses, and describes them. compile.py writes, per cell "row|col", into #p-cells:
// [cells to highlight, cells the method comes from (dashed outline), description].
(function () {
  var table = document.getElementById('p-table');
  var detail = document.getElementById('p-detail');
  var cells = JSON.parse(document.getElementById('p-cells').textContent);

  function td(key) {
    var p = key.split('|');
    var b = table.querySelector('button[data-r="' + p[0] + '"][data-c="' + p[1] + '"]');
    return b && b.parentNode;
  }
  table.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-r]');
    if (!b) return;
    var c = cells[b.dataset.r + '|' + b.dataset.c];
    table.querySelectorAll('td.sel, td.src').forEach(function (x) { x.classList.remove('sel', 'src'); });
    c[1].forEach(function (k) { var x = td(k); if (x) x.classList.add('src'); });
    c[0].forEach(function (k) { var x = td(k); if (x) x.classList.add('sel'); });
    detail.innerHTML = c[2];
  });
})();
