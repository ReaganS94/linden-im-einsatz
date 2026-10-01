const $ = selector => document.querySelector(selector);
const formatNumber = number => number.toLocaleString('de-DE');
const dateFormat = new Intl.DateTimeFormat('de-DE', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const shortMonths = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const isoDate = iso => new Date(`${iso}T12:00:00Z`);
const dateLabel = iso => dateFormat.format(isoDate(iso));
const berlinToday = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

function setTheme(next) {
  document.documentElement.dataset.theme = next;
  localStorage.setItem('linden-theme', next);
  $('#mode-button').setAttribute('aria-label', next === 'dark' ? 'Helle Ansicht einschalten' : 'Dunkle Ansicht einschalten');
}
const storedTheme = localStorage.getItem('linden-theme');
if (storedTheme === 'light' || storedTheme === 'dark') setTheme(storedTheme);
$('#mode-button').addEventListener('click', () => {
  const current = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

function eligible(entry) { return !entry.service && !entry.duplicate; }
function daysBetween(start, end) { return Math.round((isoDate(end) - isoDate(start)) / 86400000); }

function renderFreshness(data) {
  const gap = Math.max(0, daysBetween(data.latest, berlinToday()));
  const age = gap === 0 ? 'heute' : gap === 1 ? 'vor 1 Tag' : `vor ${gap} Tagen`;
  $('#freshness').innerHTML = `<span>Jüngster veröffentlichter Eintrag</span><strong>${dateLabel(data.latest)}</strong><span class="${gap >= 7 ? 'late' : ''}">${age} · Liste geprüft am ${dateLabel(data.checked_on)}</span>`;
}

function countsByDay(entries) {
  const days = new Map();
  for (const entry of entries) days.set(entry.date, (days.get(entry.date) || 0) + 1);
  return days;
}

function renderRanks(target, entries, field, selected, onChoose) {
  const totals = new Map();
  for (const entry of entries) {
    const label = entry[field] || 'Ohne Stadtteil';
    totals.set(label, (totals.get(label) || 0) + 1);
  }
  const ordered = [...totals].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],'de'));
  const max = ordered[0]?.[1] || 1;
  target.replaceChildren(...ordered.map(([label,value]) => {
    const button = document.createElement('button');
    button.className = 'rank-row'; button.type = 'button';
    button.setAttribute('aria-pressed', String(selected?.field === field && selected?.value === label));
    button.setAttribute('aria-label', `${label}: ${value} ${value === 1 ? 'Eintrag' : 'Einträge'}. Für Monatsverlauf auswählen`);
    const name = document.createElement('span'); name.className = 'rank-name'; name.textContent = label;
    const track = document.createElement('span'); track.className = 'rank-track';
    const fill = document.createElement('span'); fill.className = 'rank-fill'; fill.style.width = `${value/max*100}%`; track.append(fill);
    const count = document.createElement('strong'); count.className = 'rank-value'; count.textContent = formatNumber(value);
    button.append(name,track,count);
    button.addEventListener('click', () => onChoose(field,label));
    return button;
  }));
}

function renderTime(entries) {
  const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
  const periods = ['0–6 Uhr','6–12 Uhr','12–18 Uhr','18–24 Uhr'];
  const grid = Array.from({length:7}, () => [0,0,0,0]);
  let unknown = 0;
  for (const entry of entries) {
    if (!entry.time_known) {unknown++; continue;}
    const weekday = (isoDate(entry.date).getUTCDay()+6)%7;
    grid[weekday][Math.floor(Number(entry.time.slice(0,2))/6)]++;
  }
  const max = Math.max(1,...grid.flat());
  const box = $('#time-grid');
  box.replaceChildren();
  const corner = document.createElement('span'); box.append(corner);
  for (const period of periods) {const head=document.createElement('span'); head.className='time-head'; head.textContent=period; box.append(head);}
  days.forEach((day,i) => {
    const label=document.createElement('span'); label.className='time-day'; label.textContent=day; box.append(label);
    grid[i].forEach((value,j) => {
      const cell=document.createElement('span'); cell.className=`time-cell${value/max>.57?' strong':''}`;
      cell.style.setProperty('--strength', String(value/max));
      cell.title=`${day}, ${periods[j]}: ${value} Einträge`;
      cell.textContent=value || '–'; box.append(cell);
    });
  });
  box.setAttribute('aria-label', `${days.map((day,i) => `${day}: ${grid[i].map((count,j) => `${periods[j]} ${count}`).join(', ')}`).join('; ')}`);
  $('#time-count').textContent = `${formatNumber(entries.length-unknown)} mit Uhrzeit`;
  $('#time-note').textContent = unknown ? `${formatNumber(unknown)} Einträge mit nicht verlässlicher Uhrzeit sind hier ausgelassen.` : 'Alle gezeigten Einträge haben eine angegebene Uhrzeit.';
}

function buildChart(data) {
  const select = $('#year-choice');
  const years = [...new Set(data.entries.map(entry => entry.date.slice(0,4)))].sort();
  select.replaceChildren(...years.map(year => {
    const option = document.createElement('option'); option.value = year; option.textContent = year; return option;
  }));
  select.value = years.at(-1);

  let chosen = null;
  function choose(field,value) {
    chosen = chosen?.field === field && chosen?.value === value ? null : {field,value};
    render();
    if (chosen) $('#verlauf').scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('#clear-active').addEventListener('click', () => {chosen=null;render();});
  function render() {
    const year = select.value;
    const yearEntries = data.entries.filter(entry => eligible(entry) && entry.date.startsWith(year));
    const active = chosen ? yearEntries.filter(entry => (entry[chosen.field] || 'Ohne Stadtteil') === chosen.value) : yearEntries;
    const perDay = countsByDay(yearEntries);
    const peakDays = new Set([...perDay].filter(([,count]) => count > 10).map(([day]) => day));
    const exclude = $('#calm-days').checked;
    const shown = active.filter(entry => !exclude || !peakDays.has(entry.date));
    const lastMonth = year === data.checked_on.slice(0,4) ? Number(data.checked_on.slice(5,7)) : 12;
    const buckets = Array.from({length:lastMonth}, (_, index) => ({month:index+1,count:0,peak:0}));
    for (const entry of shown) buckets[Number(entry.date.slice(5,7))-1].count++;
    for (const entry of active) if (peakDays.has(entry.date)) buckets[Number(entry.date.slice(5,7))-1].peak++;
    const max = Math.max(1, ...buckets.map(bucket => bucket.count));
    const chart = $('#month-chart');
    chart.replaceChildren(...buckets.map(bucket => {
      const column = document.createElement('div');
      column.className = `month-col${bucket.peak && !exclude ? ' is-peak' : ''}`;
      column.tabIndex = 0;
      column.setAttribute('aria-label', `${shortMonths[bucket.month-1]} ${year}: ${bucket.count} Einträge${exclude && bucket.peak ? `, ${bucket.peak} aus Spitzentagen ausgeblendet` : ''}`);
      const value = document.createElement('span'); value.className = 'month-value'; value.textContent = bucket.count || '–';
      const bar = document.createElement('div'); bar.className = 'month-bar'; bar.style.height = `${Math.max(3, Math.round(bucket.count/max*205))}px`;
      const label = document.createElement('small'); label.textContent = shortMonths[bucket.month-1];
      column.append(value,bar,label);
      return column;
    }));
    chart.setAttribute('aria-label', `${year}: ${buckets.map(bucket => `${shortMonths[bucket.month-1]} ${bucket.count}`).join(', ')} Einsatz-Einträge`);
    $('#year-note').textContent = year === data.checked_on.slice(0,4) ? `${year} ist noch nicht abgeschlossen. Bisher sind Einträge bis ${dateLabel(data.latest)} veröffentlicht.` : `Vergleich der veröffentlichten Einträge aus ${year}. Ob die Liste damals vollständig war, ist nicht bekannt.`;
    const hidden = active.length - shown.length;
    const dayWord = peakDays.size === 1 ? 'Tag' : 'Tage';
    const entryWord = hidden === 1 ? 'Eintrag' : 'Einträge';
    $('#calm-note').textContent = exclude ? `${peakDays.size} ${dayWord} ausgeblendet · ${hidden} ${entryWord}` : `${peakDays.size} ${dayWord} mit mehr als 10 Einträgen`;
    renderRanks($('#kind-list'), yearEntries, 'kind', chosen, choose);
    renderRanks($('#district-list'), yearEntries, 'district', chosen, choose);
    renderTime(active);
    $('#active-filter').hidden = !chosen;
    if (chosen) $('#active-filter-text').textContent = `Monatsverlauf für: ${chosen.value}`;
  }
  select.addEventListener('change', render);
  $('#calm-days').addEventListener('change', render);
  render();
}

function initRandom(data) {
  const byDate = new Map();
  for (const entry of data.entries.filter(eligible)) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  }
  const days = [...byDate.keys()];
  let previous = '';
  $('#random-button').addEventListener('click', () => {
    let day = days[Math.floor(Math.random()*days.length)];
    if (days.length > 1 && day === previous) day = days[(days.indexOf(day)+1)%days.length];
    previous = day;
    const rows = byDate.get(day);
    const box = $('#random-result'); box.replaceChildren();
    const heading = document.createElement('strong'); heading.className='random-date'; heading.textContent=dateLabel(day);
    const summary = document.createElement('span'); summary.className='random-summary'; summary.textContent=`${rows.length} ${rows.length===1?'Eintrag':'Einträge'} an diesem Tag`;
    const list = document.createElement('ul'); list.className='random-examples';
    const examples = [...new Set(rows.map(row => `${row.event}${row.district ? ` · ${row.district}` : ''}`))].slice(0,3);
    for (const example of examples) {const item=document.createElement('li'); item.textContent=example; list.append(item);}
    const link = document.createElement('a'); link.href=data.source; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent='In der Liste nachsehen';
    box.append(heading,summary,list,link);
  });
}

async function renderForecast() {
  try {
    const response = await fetch('forecast.json', {cache:'no-cache'});
    if (!response.ok) throw new Error('No forecast record');
    const forecast = await response.json();
    const {scored,logged,minimum_scored:needed} = forecast;
    $('#forecast-progress-fill').style.width = `${Math.min(100,scored/needed*100)}%`;
    $('#forecast-progress-text').textContent = `${formatNumber(scored)} von ${needed} Tagen geprüft · ${formatNumber(logged)} ${logged === 1 ? 'Vermutung' : 'Vermutungen'} vorher festgehalten`;
    if (scored < needed) {
      $('#forecast-headline').textContent = 'Noch keine Tageszahl';
      $('#forecast-detail').textContent = logged === 0 ? 'Die tägliche Prüfung beginnt mit der Veröffentlichung. Danach werden Vermutungen vor dem jeweiligen Tag festgehalten.' : scored === 0 ? `Die erste Vermutung lässt sich frühestens am ${dateLabel(forecast.first_score_date)} prüfen. Bis dahin zeigen wir bewusst keine Zahl für heute.` : `Erst nach ${needed} geprüften Tagen zeigen wir eine Vermutung für heute. Bisher sind es ${scored}.`;
      return;
    }
    if (forecast.today && forecast.today.target === berlinToday()) {
      $('#forecast-headline').textContent = `Heute: ${Math.round(forecast.today.chance*100)} %`;
      $('#forecast-detail').textContent = `Nur eine Vermutung über einen veröffentlichten Eintrag. An ${scored} früher geschätzten Tagen: ${Math.round(forecast.mean_error*1000)/10} Fehlerpunkte; eine einfache Vergleichszahl kam auf ${Math.round(forecast.simple_mean_error*1000)/10}. Weniger ist besser.`;
    } else {
      $('#forecast-headline').textContent = 'Heute keine aktuelle Vermutung';
      $('#forecast-detail').textContent = 'Die Liste wurde heute noch nicht geprüft. Eine alte Tageszahl wäre irreführend.';
    }
  } catch (_) {
    $('#forecast-headline').textContent = 'Prüfung pausiert';
    $('#forecast-detail').textContent = 'Für den Ausblick fehlen gerade die Vergleichsdaten. Die übrigen Ansichten bleiben nutzbar.';
  }
}

async function start() {
  try {
    const response = await fetch('data.json', {cache:'no-cache'});
    if (!response.ok) throw new Error('Source data unavailable');
    const data = await response.json();
    const entries = data.entries.filter(eligible);
    $('#main-count').textContent = formatNumber(entries.length);
    $('#listed-count').textContent = formatNumber(data.entries.length);
    $('#service-count').textContent = formatNumber(data.entries.filter(entry => entry.service).length);
    $('#repeat-count').textContent = formatNumber(data.entries.filter(entry => entry.duplicate).length);
    $('#storm-count').textContent = formatNumber(data.entries.filter(entry => entry.date === '2026-07-14').length);
    $('#method-listed').textContent = formatNumber(data.entries.length);
    $('#method-counted').textContent = formatNumber(entries.length);
    $('#method-services').textContent = formatNumber(data.entries.filter(entry => entry.service).length);
    $('#method-repeats').textContent = formatNumber(data.entries.filter(entry => entry.duplicate && !entry.service).length);
    $('#method-bulk-repeats').textContent = formatNumber(data.uncertain_bulk_repeats);
    $('#method-unknown').textContent = formatNumber(entries.filter(entry => !entry.time_known).length);
    renderFreshness(data);
    buildChart(data);
    initRandom(data);
    renderForecast();
  } catch (_) {
    $('#freshness').textContent = 'Die Liste konnte gerade nicht geladen werden. Bitte später noch einmal vorbeischauen.';
    $('#year-note').textContent = 'Die Zahlen sind gerade nicht verfügbar.';
  }
}
start();
