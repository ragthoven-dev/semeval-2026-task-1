import { MAX_HEADLINES, parseHeadlines, buildPromptPack, toDelimited } from './prompt-builder.js';

const REPOSITORY = 'https://github.com/ragthoven-dev/semeval-2026-task-1';
const PAPER = 'https://aclanthology.org/2026.semeval-1.416/';
const DRAFT_KEY = 'mwahaha-prompt-draft-v1';
const LANGUAGES = { sk: 'Slovak', en: 'English', es: 'Spanish', zh: 'Chinese' };

export function escapeHTML(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function normalize(value = '') {
  return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

function safeURL(value) {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function humanize(name = '') {
  return String(name).toLowerCase().replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

const e = escapeHTML;
const action = (name, label, extra = '', classes = '') => `<button type="button" data-action="${e(name)}" ${extra} class="${e(classes)}">${label}</button>`;
const downloadLink = (filename, label) => `<a href="./downloads/${e(filename)}" download>${e(label)}</a>`;
const empty = (title, description, button = '') => `<div class="empty-state"><h2>${e(title)}</h2><p>${e(description)}</p>${button}</div>`;

let catalog;
let app;
let toastTimeout;
const state = {
  route: 'home',
  showcase: { search: '', scope: 'all', layout: 'magazine', index: 0, revealed: false },
  mechanismIndex: 0,
  sources: { search: '', mechanism: '', topic: '', limit: 12 },
  usageIndex: 0,
  builder: { headlines: '', language: 'sk', word1: '', word2: '', context: '', mechanism: '', exampleIds: [], save: false, output: '', builtRows: [], error: '', stale: false },
};

function pageTop(eyebrow, heading, description) {
  return `<div class="page-top"><span class="eyebrow">${e(eyebrow)}</span><h1 id="route-heading" tabindex="-1">${heading}</h1><p class="intro">${description}</p></div>`;
}

function notify(message) {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3600);
}

async function copyText(text, success = 'Copied to clipboard.') {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
  } catch {
    const previous = document.activeElement;
    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.setAttribute('aria-label', 'Text to copy');
    fallback.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px';
    document.body.append(fallback);
    fallback.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* Browser may prohibit clipboard access. */ }
    fallback.remove();
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    if (!copied) {
      const output = document.getElementById('builder-output');
      if (output) { output.focus(); output.select(); }
      notify('Copy unavailable in this browser. Select the text to copy, or download it.');
      return false;
    }
  }
  notify(success);
  return true;
}

function shareURL(route, id) {
  const url = new URL(window.location.href);
  url.hash = `/${route}/${encodeURIComponent(id)}`;
  return url.href;
}

async function shareRecord(record, route = 'showcase') {
  const url = shareURL(route, record.id);
  if (navigator.share) {
    try { await navigator.share({ title: 'MWAHAHA — headline humor', text: record.headline, url }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  await copyText(url, 'Link copied. It opens this headline directly.');
}

function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sourceLink(source) {
  const url = safeURL(source);
  return url ? `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">Original source <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>` : '<span class="caption">Source unavailable</span>';
}

function sourceCard(joke, { compact = false, number = null } = {}) {
  return `<article class="source-card" data-testid="source-card" data-source-id="${e(joke.id)}"><div class="card-top"><span class="pill">${e(humanize(joke.mechanism))}</span><span class="tag">${number === null ? e(joke.id) : `0${number}`}</span></div><h2>${e(joke.joke)}</h2><p class="source-summary">${e(joke.summary)}</p><div class="source-topics">${e(joke.topic)}</div><div class="source-actions">${sourceLink(joke.source)}${compact ? `<a href="#/sources/${encodeURIComponent(joke.id)}">View in library</a>` : action('source-use', 'Use as inspiration', `data-id="${e(joke.id)}"`, 'quiet')}</div></article>`;
}

function homeView() {
  const featured = catalog.showcase.find(record => /maskot/.test(record.headline)) || catalog.showcase[0];
  const rawMechanisms = new Set(catalog.jokes.map(joke => joke.mechanism)).size;
  return `<section class="hero" aria-labelledby="route-heading"><div><span class="eyebrow">RAGTHOVEN × SEMEVAL 2026</span><h1 id="route-heading" tabindex="-1">A little news.<br>A <em>different</em><br>ending.</h1><p class="intro">What happens when a headline meets a sense of humor? Explore the jokes, follow the ideas behind them, and give your own headlines a fresh angle.</p><div class="actions"><a class="button primary" href="#/showcase">Read the jokes <span aria-hidden="true">→</span></a><a class="button" href="#/builder">Try your headlines</a></div><p class="hero-note">A research project about the craft of generating humor.</p></div><div class="hero-sample" lang="sk"><div class="hero-sample-top"><span>THE HEADLINE / THE TWIST</span><span>01</span></div><div class="hero-sample-content"><span class="eyebrow" lang="en">IT STARTED WITH A HEADLINE</span><p class="hero-headline">${e(featured?.headline || 'A familiar headline, seen differently.')}</p><p class="hero-joke">${e(featured?.text || 'Explore the showcase to discover the results.')}</p><a href="#/showcase/${encodeURIComponent(featured?.id || '')}" lang="en">Read the full showcase <span aria-hidden="true">↗</span></a></div></div></section>
  <div class="stat-strip" aria-label="Inside the collection"><div class="stat"><strong>${catalog.showcase.length}</strong><span>headlines, reimagined in Slovak</span></div><div class="stat"><strong>${catalog.jokes.length}</strong><span>source jokes for inspiration</span></div><div class="stat"><strong>${catalog.mechanisms.length}</strong><span>ways to make a twist</span></div><div class="stat"><strong>4</strong><span>stages from idea to punchline</span></div></div>
  <section aria-labelledby="explore-heading"><div class="section-top"><h2 id="explore-heading">There’s a method to the madness.</h2><p>A good joke needs more than a surprise. It needs an idea, a connection, and a well-placed ending.</p></div><div class="explore-grid"><a class="explore-card" href="#/mechanisms"><span class="card-number" aria-hidden="true">01</span><h3>Find the mechanism.</h3><p>Meet ${catalog.mechanisms.length} patterns that turn an ordinary observation into something unexpected.</p><span class="text-link">Explore the mechanisms <span aria-hidden="true">↗</span></span></a><a class="explore-card" href="#/sources"><span class="card-number" aria-hidden="true">02</span><h3>Borrow an angle.</h3><p>Browse ${catalog.jokes.length} source jokes and ${rawMechanisms} corpus labels. Take inspiration from the structure, then make something new.</p><span class="text-link">Open the source library <span aria-hidden="true">↗</span></span></a><a class="explore-card" href="#/usage"><span class="card-number" aria-hidden="true">03</span><h3>Look behind the joke.</h3><p>See which source examples were retrieved for a headline and how they appeared in the recorded prompts.</p><span class="text-link">Follow the inspiration <span aria-hidden="true">↗</span></span></a></div></section>
  <section class="workflow" aria-labelledby="workflow-heading"><div class="section-top"><h2 id="workflow-heading">An idea. A draft. A second look.</h2><a class="text-link" href="#/builder">Prepare your own prompts <span aria-hidden="true">→</span></a></div><div class="steps"><div class="step"><span class="step-number">01 / PLANNER</span><h3>Find a different frame</h3><p>Explore angles, spot pitfalls, and plan a surprising connection.</p></div><div class="step"><span class="step-number">02 / WRITER</span><h3>Give the idea a voice</h3><p>Draft a set of candidates with different routes to the punchline.</p></div><div class="step"><span class="step-number">03 / REFLECTOR</span><h3>Take a second look</h3><p>Find the weak spots and rewrite the most promising jokes.</p></div><div class="step"><span class="step-number">04 / JUDGE</span><h3>Choose the landing</h3><p>Select a valid candidate and polish its final twist.</p></div></div></section>
  <aside class="research-panel"><div><span class="eyebrow">FROM THE RESEARCH</span><h2>Built to ask what makes humor work.</h2><p>MWAHAHA is SemEval 2026 Task 1 on humor generation. This project explores staged generation with RAGthoven: retrieving examples for inspiration, then planning, drafting, reflecting, and choosing.</p></div><div class="actions"><a class="button" href="${PAPER}" target="_blank" rel="noopener noreferrer">Read the paper <span aria-hidden="true">↗</span></a><a class="button quiet" href="${REPOSITORY}" target="_blank" rel="noopener noreferrer">View the code <span aria-hidden="true">↗</span></a></div></aside>`;
}

function filteredShowcase() {
  const { search, scope } = state.showcase;
  const query = normalize(search.trim());
  return catalog.showcase.filter(record => (scope !== 'first' || record.first_batch) && (!query || normalize(`${record.id} ${record.headline} ${record.text}`).includes(query)));
}

function showcaseView() {
  return `${pageTop('THE SHOWCASE', 'The news, with a twist.', `${catalog.showcase.length} Slovak headlines, paired with the jokes they inspired. Explore university life through a different lens, or hide the joke until you’re ready for the punchline.`)}
  <div class="filters two"><div class="field"><label for="showcase-search">Find a headline or joke</label><input type="search" id="showcase-search" value="${e(state.showcase.search)}" placeholder="Try a word, a topic, or a headline ID" autocomplete="off"></div><div class="field"><label for="showcase-scope">Collection</label><select id="showcase-scope"><option value="all" ${state.showcase.scope === 'all' ? 'selected' : ''}>All ${catalog.showcase.length} headlines</option><option value="first" ${state.showcase.scope === 'first' ? 'selected' : ''}>First batch · ${catalog.showcase.filter(record => record.first_batch).length} headlines</option></select></div></div>
  <div class="toolbar"><p id="showcase-count" class="caption" role="status"></p><div class="segmented" role="group" aria-label="Showcase layout">${['magazine', 'compare', 'reveal'].map(layout => action('showcase-layout', layout === 'reveal' ? 'Live reveal' : humanize(layout), `data-layout="${layout}" aria-pressed="${state.showcase.layout === layout}"`, '')).join('')}</div></div><div id="showcase-results"></div>
  <div class="download-bar"><p>Keep the collection, with headline and joke side by side.</p><div class="download-links">${downloadLink('showcase-full.csv', 'All 33 · CSV')}${downloadLink('showcase-full.tsv', 'All 33 · TSV')}${downloadLink('showcase-first-batch.csv', 'First 12 · CSV')}${downloadLink('showcase-first-batch.tsv', 'First 12 · TSV')}</div></div><p class="note cards-note">The recorded jokes were generated with Claude Opus 4.5 in the staged exp09 workflow and received a small editorial pass. The headlines concern Univerzita Komenského in Bratislava. “UK” here means the university.</p>`;
}

function showcaseActions(record, { compare = false } = {}) {
  return `<div class="actions">${action('copy-joke', 'Copy joke', `data-id="${e(record.id)}"`, compare ? 'small-button quiet' : 'small-button')}${action('share-joke', 'Share', `data-id="${e(record.id)}"`, compare ? 'small-button quiet' : 'small-button')}${compare ? '' : action('headline-use', 'Try this headline', `data-id="${e(record.id)}"`, 'quiet small-button')}</div>`;
}

function updateShowcaseResults() {
  const records = filteredShowcase();
  state.showcase.index = Math.max(0, Math.min(state.showcase.index, records.length - 1));
  document.getElementById('showcase-count').textContent = `${records.length} ${records.length === 1 ? 'headline' : 'headlines'}${state.showcase.search ? ' found' : ' in this collection'} · jokes in Slovak`;
  document.querySelectorAll('[data-action="showcase-layout"]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === state.showcase.layout)));
  const results = document.getElementById('showcase-results');
  if (!records.length) {
    results.innerHTML = empty('No headlines found.', 'Try a different word or switch back to the full collection.', action('showcase-reset', 'Clear filters'));
    return;
  }
  if (state.showcase.layout === 'compare') {
    results.innerHTML = `<div class="compare-list" data-testid="showcase-compare">${records.map(record => `<article class="compare-card" data-testid="showcase-record" data-headline-id="${e(record.id)}"><div class="compare-body" lang="sk"><div class="compare-headline"><span class="eyebrow" lang="en">THE HEADLINE</span><h2>${e(record.headline)}</h2></div><div class="compare-joke"><span class="eyebrow" lang="en">THE JOKE</span><p>${e(record.text)}</p></div></div><div class="compare-footer"><span class="tag">${e(record.id)}${record.first_batch ? ' · first batch' : ''}</span>${showcaseActions(record, { compare: true })}</div></article>`).join('')}</div>`;
    return;
  }
  const record = records[state.showcase.index];
  const reveal = state.showcase.layout === 'reveal';
  results.innerHTML = `<div class="record-picker"><div><label for="showcase-picker">Choose a headline</label><select id="showcase-picker">${records.map((item, index) => `<option value="${index}" ${index === state.showcase.index ? 'selected' : ''}>${index + 1}. ${e(item.headline)}</option>`).join('')}</select></div><div class="pager" aria-label="Browse headlines">${action('showcase-prev', '← <span class="sr-only">Previous headline</span>', `aria-label="Previous headline" ${state.showcase.index === 0 ? 'disabled' : ''}`)}<span class="position">${state.showcase.index + 1} / ${records.length}</span>${action('showcase-next', '→ <span class="sr-only">Next headline</span>', `aria-label="Next headline" ${state.showcase.index === records.length - 1 ? 'disabled' : ''}`)}</div></div>
  <article class="headline-card ${reveal ? 'live-card' : ''}" data-testid="showcase-record" data-headline-id="${e(record.id)}"><div class="headline-meta"><span class="eyebrow">${reveal ? 'SAVE THE PUNCHLINE FOR LAST' : 'THE HEADLINE / THE TWIST'}</span><span class="tag">${e(record.id)}${record.first_batch ? '<br>first batch' : ''}</span></div><h2 lang="sk">${e(record.headline)}</h2><div class="joke-block">${reveal ? `<div class="reveal-hidden" ${state.showcase.revealed ? 'hidden' : ''}>${action('showcase-reveal', 'Reveal the joke <span aria-hidden="true">↘</span>', 'aria-controls="revealed-joke" aria-expanded="false"', 'reveal-button')}</div><div id="revealed-joke" ${state.showcase.revealed ? '' : 'hidden'}><span class="eyebrow">THE JOKE</span><p class="joke-text" lang="sk">${e(record.text)}</p></div>` : `<span class="eyebrow">THE JOKE</span><p class="joke-text" lang="sk">${e(record.text)}</p>`}</div><div class="article-bottom"><span class="caption">${reveal ? 'A pause makes room for the surprise.' : 'A fresh angle on university life.'}</span>${showcaseActions(record)}</div></article>`;
}

function mechanismsView() {
  return `${pageTop('THE MECHANISM LIBRARY', 'A twist has a shape.', 'Sixteen reference patterns for finding an unexpected connection. Step through the definitions and examples, then bring a mechanism into your own prompt pack.')}
  <div class="mechanism-controls"><div><label for="mechanism-picker">Choose a mechanism</label><select id="mechanism-picker">${catalog.mechanisms.map((mechanism, index) => `<option value="${index}" ${index === state.mechanismIndex ? 'selected' : ''}>${String(index + 1).padStart(2, '0')} · ${e(humanize(mechanism.name))}</option>`).join('')}</select></div><div class="pager" aria-label="Browse mechanisms">${action('mechanism-prev', '←', 'aria-label="Previous mechanism"')}<span class="position" id="mechanism-position"></span>${action('mechanism-next', '→', 'aria-label="Next mechanism"')}</div></div>
  <div id="mechanism-details" aria-live="polite"></div><div class="catalog-heading"><h2>All ${catalog.mechanisms.length} mechanisms</h2><span class="caption">Choose a different angle.</span></div><div class="mechanism-grid" role="group" aria-label="Reference mechanisms">${catalog.mechanisms.map((mechanism, index) => action('mechanism-select', `<span class="number">${String(index + 1).padStart(2, '0')}</span>${e(humanize(mechanism.name))}`, `data-index="${index}" aria-pressed="${index === state.mechanismIndex}"`)).join('')}</div>
  <div class="download-bar"><p>This reference catalog comes from the project’s prompt design.</p><div class="download-links">${downloadLink('mechanisms.json', 'Download mechanisms · JSON')}</div></div><p class="note cards-note">These ${catalog.mechanisms.length} reference patterns and the ${new Set(catalog.jokes.map(joke => joke.mechanism)).size} labels in the source corpus are separate vocabularies. A source joke’s label does not imply a one-to-one match with this catalog.</p>`;
}

function updateMechanismDetails() {
  const mechanism = catalog.mechanisms[state.mechanismIndex];
  if (!mechanism) return;
  document.getElementById('mechanism-details').innerHTML = `<article class="mechanism-feature" data-testid="mechanism-feature"><span class="tag">${e(mechanism.name)}</span><h2>${e(humanize(mechanism.name))}</h2><p class="mechanism-desc">${e(mechanism.desc)}</p><div class="examples"><div class="example-box"><span class="eyebrow">EXAMPLE 01</span><p>${e(mechanism.ex1)}</p></div><div class="example-box"><span class="eyebrow">EXAMPLE 02</span><p>${e(mechanism.ex2)}</p></div></div><div class="article-bottom"><span class="caption">Look for the connection between the setup and the new frame.</span>${action('mechanism-use', 'Use in a prompt pack <span aria-hidden="true">↗</span>', '', 'primary small-button')}</div></article>`;
  document.getElementById('mechanism-position').textContent = `${state.mechanismIndex + 1} / ${catalog.mechanisms.length}`;
  document.getElementById('mechanism-picker').value = String(state.mechanismIndex);
  document.querySelectorAll('[data-action="mechanism-select"]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.index) === state.mechanismIndex)));
  document.querySelector('[data-action="mechanism-prev"]').disabled = state.mechanismIndex === 0;
  document.querySelector('[data-action="mechanism-next"]').disabled = state.mechanismIndex === catalog.mechanisms.length - 1;
}

function topicsOf(joke) { return String(joke.topic || '').split(',').map(topic => topic.trim()).filter(Boolean); }

function sourcesView() {
  const labels = [...new Set(catalog.jokes.map(joke => joke.mechanism))].sort();
  const topics = [...new Set(catalog.jokes.flatMap(topicsOf))].sort();
  return `${pageTop('THE SOURCE JOKE LIBRARY', 'A collection of starting points.', `${catalog.jokes.length} joke lines, each with a summary, a mechanism label, and a source. Explore the angle behind a joke, or manually choose examples for your own prompt pack.`)}
  <div class="filters three"><div class="field"><label for="source-search">Search the collection</label><input type="search" id="source-search" value="${e(state.sources.search)}" placeholder="A word, a topic, a summary, or an ID" autocomplete="off"></div><div class="field"><label for="source-mechanism">Corpus mechanism</label><select id="source-mechanism"><option value="">All ${labels.length} labels</option>${labels.map(label => `<option value="${e(label)}" ${state.sources.mechanism === label ? 'selected' : ''}>${e(humanize(label))}</option>`).join('')}</select></div><div class="field"><label for="source-topic">Topic</label><select id="source-topic"><option value="">All topics</option>${topics.map(topic => `<option value="${e(topic)}" ${state.sources.topic === topic ? 'selected' : ''}>${e(humanize(topic))}</option>`).join('')}</select></div></div>
  <div class="toolbar"><span class="caption" id="source-count" role="status"></span>${action('source-reset', 'Clear filters', '', 'quiet small-button')}</div><div id="source-results"></div><div class="download-bar"><p>Take the full source collection with you.</p><div class="download-links">${downloadLink('jokes.csv', 'Source jokes · CSV')}${downloadLink('jokes.tsv', 'Source jokes · TSV')}</div></div><p class="note cards-note">Sources remain linked to their original publishers. Use the examples for mechanisms and angles, without copying their wording or specific details. Corpus labels are preserved as recorded.</p>`;
}

function updateSourceResults() {
  const query = normalize(state.sources.search.trim());
  const records = catalog.jokes.filter(joke => (!state.sources.mechanism || joke.mechanism === state.sources.mechanism) && (!state.sources.topic || topicsOf(joke).includes(state.sources.topic)) && (!query || normalize(`${joke.id} ${joke.joke} ${joke.summary} ${joke.mechanism} ${joke.topic} ${joke.source}`).includes(query)));
  const visible = records.slice(0, state.sources.limit);
  document.getElementById('source-count').textContent = records.length ? `${records.length} ${records.length === 1 ? 'source joke' : 'source jokes'} · showing ${visible.length}` : 'No matching source jokes';
  document.getElementById('source-results').innerHTML = records.length ? `<div class="source-cards">${visible.map(joke => sourceCard(joke)).join('')}</div>${visible.length < records.length ? `<div class="more-row">${action('source-more', `Show ${Math.min(12, records.length - visible.length)} more jokes`, '', '')}</div>` : ''}` : empty('No jokes found.', 'Try a broader search, a different mechanism, or clear the filters.', action('source-reset', 'Clear filters'));
}

function usageView() {
  return `${pageTop('RAG IN ACTION', 'Where did that angle come from?', 'Follow the first recorded planner and writer calls for each headline. Four source jokes were retrieved; the inspiration passed to a stage may be summarized. The example blocks appear in the user prompts, alongside the separate system instructions.')}
  <div class="record-picker"><div><label for="usage-picker">Choose a recorded headline</label><select id="usage-picker">${catalog.usage.map((record, index) => `<option value="${index}" ${index === state.usageIndex ? 'selected' : ''}>${index + 1}. ${e(record.headline)}</option>`).join('')}</select></div><div class="pager" aria-label="Browse recorded headlines">${action('usage-prev', '←', 'aria-label="Previous recorded headline"')}<span class="position" id="usage-position"></span>${action('usage-next', '→', 'aria-label="Next recorded headline"')}</div></div><div id="usage-details"></div>`;
}

function promptPanel(stage, title, description) {
  const record = catalog.usage[state.usageIndex];
  const prompt = record[stage] || {};
  return `<section class="prompt-panel"><span class="eyebrow">RECORDED ${e(stage.toUpperCase())} INPUT</span><h3>${e(title)}</h3><p>${e(description)}</p><div class="inspiration-preview">${e(prompt.inspiration || 'No inspiration text recorded for this stage.')}</div><details><summary>Read the full system prompt</summary><pre tabindex="0" aria-label="${e(stage)} system prompt">${e(prompt.system_prompt || 'No system prompt recorded.')}</pre>${action('copy-recorded-prompt', 'Copy system prompt', `data-stage="${stage}" data-prompt-kind="system_prompt"`, 'small-button')}</details><details><summary>Read the full user prompt</summary><pre tabindex="0" aria-label="${e(stage)} user prompt">${e(prompt.user_prompt || 'No user prompt recorded.')}</pre>${action('copy-recorded-prompt', 'Copy user prompt', `data-stage="${stage}" data-prompt-kind="user_prompt"`, 'small-button')}</details></section>`;
}

function updateUsageDetails() {
  const record = catalog.usage[state.usageIndex];
  if (!record) {
    document.getElementById('usage-details').innerHTML = empty('No recorded prompts available.', 'You can still explore the source library and prepare prompts for your own headlines.', '<a class="button" href="#/sources">Open the library</a>');
    return;
  }
  const sources = record.retrieved_source_ids.map(id => catalog.jokes.find(joke => joke.id === id)).filter(Boolean);
  document.getElementById('usage-position').textContent = `${state.usageIndex + 1} / ${catalog.usage.length}`;
  document.getElementById('usage-picker').value = String(state.usageIndex);
  document.querySelector('[data-action="usage-prev"]').disabled = state.usageIndex === 0;
  document.querySelector('[data-action="usage-next"]').disabled = state.usageIndex === catalog.usage.length - 1;
  document.getElementById('usage-details').innerHTML = `<article class="headline-card usage-final"><div class="headline-meta"><span class="eyebrow">THE HEADLINE / THE FINAL JOKE</span><span class="tag">${e(record.id)}</span></div><h2 lang="sk">${e(record.headline)}</h2><div class="joke-block"><p class="joke-text" lang="sk">${e(record.final_joke)}</p></div><div class="article-bottom"><a class="text-link" href="#/showcase/${encodeURIComponent(record.id)}">Open in the showcase <span aria-hidden="true">↗</span></a>${action('share-usage', 'Share this record', '', 'small-button')}</div></article><div class="usage-steps" aria-label="Inspiration flow"><span class="usage-step"><strong>Headline</strong></span><span class="arrow" aria-hidden="true">→</span><span class="usage-step"><strong>Retrieved examples</strong> · ${sources.length}</span><span class="arrow" aria-hidden="true">→</span><span class="usage-step"><strong>Planner</strong></span><span class="arrow" aria-hidden="true">→</span><span class="usage-step"><strong>Writer</strong></span></div><h2 class="section-label">The source examples retrieved for this headline</h2><div class="source-cards retrieved-cards">${sources.length ? sources.map((joke, index) => sourceCard(joke, { compact: true, number: index + 1 })).join('') : empty('No matching source examples.', 'The recorded prompt text is still available below.')}</div><div class="prompt-panels">${promptPanel('planner', 'Inspiration for the plan.', 'Mechanisms and angles to explore before drafting.')}${promptPanel('writer', 'Inspiration for the draft.', 'The example block passed to the writer in this record.')}</div><p class="note cards-note">The recorded inspiration belongs to this specific run. The final joke shown above includes the published editorial corrections. The prompt builder lets you select examples manually; it does not perform this retrieval.</p>`;
}

function builderView() {
  const draft = state.builder;
  return `${pageTop('YOUR HEADLINES, YOUR NEXT STEP', 'Give your ideas a starting point.', 'Paste your headlines and prepare a four-stage prompt pack to use with a model of your choice. This page builds the prompts; it does not run a model or generate jokes.')}
  <div class="builder-layout"><form class="builder-panel" id="builder-form" novalidate><h2>Set the scene.</h2><div class="field"><div class="field-heading"><label for="builder-headlines">Your headlines</label><span class="caption" id="builder-count">0 / 50</span></div><textarea id="builder-headlines" maxlength="40000" placeholder="One headline per line.\nFor example: The university library is staying open all night." aria-describedby="builder-headlines-help builder-error">${e(draft.headlines)}</textarea><p class="field-help" id="builder-headlines-help">One headline per line, up to 50. Keep the wording you want the joke to refer to.</p></div><div class="field"><label for="builder-language">Language of the jokes</label><select id="builder-language">${Object.entries(LANGUAGES).map(([code, name]) => `<option value="${code}" ${draft.language === code ? 'selected' : ''}>${name}</option>`).join('')}</select><p class="field-help">The instructions stay in English. The prompts request jokes in your chosen language.</p></div><div class="field"><label for="builder-word1">Required words <span class="optional-note">optional · the same pair for every headline</span></label><div class="field-row"><div><input type="text" id="builder-word1" maxlength="100" value="${e(draft.word1)}" placeholder="First word" aria-label="First required word" aria-describedby="builder-words-help"></div><div><input type="text" id="builder-word2" maxlength="100" value="${e(draft.word2)}" placeholder="Second word" aria-label="Second required word" aria-describedby="builder-words-help"></div></div><p class="field-help" id="builder-words-help">Use both fields or leave both blank. Each joke will be asked to include the exact pair in the same clause.</p></div><details id="builder-options" ${draft.mechanism || draft.exampleIds.length || draft.context ? 'open' : ''}><summary>Add an angle or inspiration <span class="optional-note">(optional)</span></summary><div class="field"><label for="builder-mechanism">Mechanism focus</label><select id="builder-mechanism"><option value="">Let the planner explore different angles</option>${catalog.mechanisms.map(mechanism => `<option value="${e(mechanism.name)}" ${draft.mechanism === mechanism.name ? 'selected' : ''}>${e(humanize(mechanism.name))}</option>`).join('')}</select></div><div class="field"><label for="builder-example-add">Source examples</label><div class="example-add"><select id="builder-example-add"><option value="">Choose an example from the library</option>${catalog.jokes.map(joke => `<option value="${e(joke.id)}">${e(joke.id)} · ${e(joke.joke)}</option>`).join('')}</select>${action('builder-add-example', 'Add example', '', '')}</div><p class="field-help">Manually select up to four examples. Their patterns become inspiration; no similarity search runs here.</p><div class="selected-examples" id="builder-selected-examples"></div></div><div class="field"><label for="builder-context">Context for the model</label><textarea id="builder-context" rows="3" maxlength="5000" placeholder="Optional: explain an abbreviation, a place, or who the audience is." style="min-height:100px">${e(draft.context)}</textarea><p class="field-help">Include relevant facts the headline alone might leave unclear.</p></div></details><div class="field-error" id="builder-error" role="alert" ${draft.error ? '' : 'hidden'}>${e(draft.error)}</div><div class="builder-bottom"><label class="check-label" for="builder-save"><input type="checkbox" id="builder-save" ${draft.save ? 'checked' : ''}>Save my draft on this device</label><div class="actions"><button type="submit" class="primary" id="builder-submit">Build prompt pack <span aria-hidden="true">→</span></button>${action('builder-clear', 'Clear draft', '', 'quiet')}</div><p class="builder-status" id="builder-status" role="status"></p></div></form><section class="output-panel" aria-labelledby="output-heading"><h2 id="output-heading">Your prompt pack.</h2><div id="builder-output-area"></div></section></div><aside class="privacy-note"><strong>Your headlines stay in this browser.</strong> Nothing you enter is sent to a model or a server by this page. Draft saving is optional and uses this device’s browser storage. Copy or download the pack when you are ready to use it elsewhere.</aside><div class="download-bar"><p>Prefer preparing your inputs in a spreadsheet?</p><div class="download-links">${downloadLink('headlines-template.csv', 'Download a headline template · CSV')}</div></div>`;
}

function updateBuilderCount() {
  const count = state.builder.headlines.split(/\r\n|\n|\r/).filter(line => line.trim()).length;
  document.getElementById('builder-count').textContent = `${count} / 50`;
  document.getElementById('builder-count').style.color = count > MAX_HEADLINES ? 'var(--wine)' : '';
}

function updateSelectedExamples() {
  const container = document.getElementById('builder-selected-examples');
  if (!container) return;
  container.innerHTML = state.builder.exampleIds.map(id => {
    const joke = catalog.jokes.find(item => item.id === id);
    return joke ? action('builder-remove-example', `${e(id)} · ${e(humanize(joke.mechanism))} <span aria-hidden="true">×</span>`, `data-id="${e(id)}" aria-label="Remove example ${e(id)}"`) : '';
  }).join('');
}

function updateBuilderOutput() {
  const draft = state.builder;
  const container = document.getElementById('builder-output-area');
  if (!container) return;
  container.innerHTML = draft.output ? `<div class="output-toolbar"><span class="pill">${draft.builtRows.length} ${draft.builtRows.length === 1 ? 'headline' : 'headlines'} · ${e(draft.builtLanguage || LANGUAGES[draft.language])}</span>${action('builder-copy', 'Copy prompt pack', '', 'small-button')}</div><label class="sr-only" for="builder-output">Prepared four-stage prompt pack</label><textarea id="builder-output" class="output-text" readonly spellcheck="false">${e(draft.output)}</textarea><p class="builder-warning" id="builder-stale" ${draft.stale ? '' : 'hidden'}>Your inputs changed. Build the pack again to update this output and its exports.</p><div class="export-row"><p>Download the prompt pack or its matching input rows.</p><div class="actions">${action('builder-download', 'Prompt pack · TXT', '', 'small-button')}${action('builder-tsv', 'Inputs · TSV', '', 'small-button')}${action('builder-csv', 'Inputs · CSV', '', 'small-button')}</div></div>` : `<div class="output-empty"><div class="output-symbol" aria-hidden="true">“ ”</div><h3>A good idea needs a little room.</h3><p>Add a headline on the left. Your prompts for all four stages will appear here.</p><div class="mini-steps"><span>Plan</span><span>Write</span><span>Reflect</span><span>Judge</span></div></div>`;
}

function persistDraft() {
  try {
    if (!state.builder.save) { localStorage.removeItem(DRAFT_KEY); return true; }
    const { headlines, language, word1, word2, context, mechanism, exampleIds } = state.builder;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, headlines, language, word1, word2, context, mechanism, exampleIds }));
    return true;
  } catch {
    const status = document.getElementById('builder-status');
    if (status) status.textContent = 'Browser storage is unavailable. You can still build, copy, and download your prompts.';
    return false;
  }
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!saved || saved.version !== 1) return;
    for (const key of ['headlines', 'word1', 'word2', 'context', 'mechanism']) {
      if (typeof saved[key] === 'string') state.builder[key] = saved[key].slice(0, key === 'headlines' ? 40000 : key === 'context' ? 5000 : 100);
    }
    if (Object.hasOwn(LANGUAGES, saved.language)) state.builder.language = saved.language;
    state.builder.exampleIds = Array.isArray(saved.exampleIds) ? [...new Set(saved.exampleIds)].filter(id => catalog.jokes.some(joke => joke.id === id)).slice(0, 4) : [];
    if (!catalog.mechanisms.some(item => item.name === state.builder.mechanism)) state.builder.mechanism = '';
    state.builder.save = true;
  } catch { /* A missing or unreadable local draft does not block the builder. */ }
}

function markBuilderChanged() {
  state.builder.stale = Boolean(state.builder.output);
  state.builder.error = '';
  const error = document.getElementById('builder-error');
  if (error) { error.hidden = true; error.textContent = ''; }
  document.getElementById('builder-headlines')?.removeAttribute('aria-invalid');
  const stale = document.getElementById('builder-stale');
  if (stale) stale.hidden = !state.builder.stale;
  const status = document.getElementById('builder-status');
  if (status) status.textContent = state.builder.save ? 'Draft saved on this device.' : '';
  persistDraft();
}

function submitBuilder() {
  const draft = state.builder;
  try {
    const rows = parseHeadlines(draft.headlines, { word1: draft.word1, word2: draft.word2 });
    const examples = draft.exampleIds.map(id => catalog.jokes.find(joke => joke.id === id)).filter(Boolean);
    const mechanism = catalog.mechanisms.find(item => item.name === draft.mechanism) || null;
    draft.output = buildPromptPack({ rows, language: draft.language, context: draft.context, examples, mechanisms: mechanism ? [mechanism] : [] });
    draft.builtRows = rows;
    draft.builtLanguage = LANGUAGES[draft.language];
    draft.builtLanguageCode = draft.language;
    draft.stale = false;
    draft.error = '';
    document.getElementById('builder-error').hidden = true;
    document.getElementById('builder-headlines').removeAttribute('aria-invalid');
    document.getElementById('builder-status').textContent = `Prepared four stages for ${rows.length} ${rows.length === 1 ? 'headline' : 'headlines'}. No model was run.`;
    persistDraft();
    updateBuilderOutput();
    document.getElementById('output-heading').setAttribute('tabindex', '-1');
    document.getElementById('output-heading').focus({ preventScroll: true });
    if (window.innerWidth < 760) document.getElementById('output-heading').scrollIntoView({ block: 'start' });
  } catch (error) {
    draft.error = error.message;
    const field = document.getElementById('builder-error');
    field.textContent = error.message;
    field.hidden = false;
    if (!draft.headlines.trim() || draft.headlines.split(/\r\n|\n|\r/).filter(line => line.trim()).length > MAX_HEADLINES) {
      document.getElementById('builder-headlines').setAttribute('aria-invalid', 'true');
      document.getElementById('builder-headlines').focus();
    } else document.getElementById(draft.word1.trim() ? 'builder-word2' : 'builder-word1').focus();
  }
}

function currentRoute() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  let id;
  try { id = decodeURIComponent(parts.slice(1).join('/')); } catch { id = ''; }
  return { view: parts[0] || 'home', id };
}

function setRecordHash(view, id) {
  history.replaceState(null, '', `#/${view}/${encodeURIComponent(id)}`);
}

function renderRoute({ focus = true } = {}) {
  const route = currentRoute();
  state.route = route.view;
  const views = { home: homeView, showcase: showcaseView, mechanisms: mechanismsView, sources: sourcesView, usage: usageView, builder: builderView };
  if (route.id && route.view === 'showcase') {
    const record = catalog.showcase.find(item => item.id === route.id);
    if (record) {
      state.showcase.search = '';
      if (!record.first_batch) state.showcase.scope = 'all';
      state.showcase.index = filteredShowcase().findIndex(item => item.id === route.id);
      state.showcase.revealed = false;
    }
  }
  if (route.id && route.view === 'usage') {
    const index = catalog.usage.findIndex(item => item.id === route.id);
    if (index >= 0) state.usageIndex = index;
  }
  if (route.id && route.view === 'sources') {
    state.sources.search = route.id;
    state.sources.mechanism = state.sources.topic = '';
    state.sources.limit = 12;
  }
  if (route.id && route.view === 'mechanisms') {
    const index = catalog.mechanisms.findIndex(mechanism => mechanism.name === route.id);
    if (index >= 0) state.mechanismIndex = index;
  }
  app.innerHTML = views[route.view] ? views[route.view]() : `${pageTop('A WRONG TURN', 'This page wandered off.', 'The view you’re looking for isn’t in this collection. Head back to the lab to choose a new direction.')}<a class="button primary" href="#/">Back to home</a>`;
  app.classList.remove('view-enter');
  void app.offsetWidth;
  app.classList.add('view-enter');
  app.setAttribute('aria-busy', 'false');
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === route.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const title = { home: 'A little news. A different ending.', showcase: 'The showcase', mechanisms: 'Humor mechanisms', sources: 'Source jokes', usage: 'RAG in action', builder: 'Your headline prompt pack' }[route.view] || 'Page not found';
  document.title = `MWAHAHA — ${title}`;
  if (route.view === 'showcase') updateShowcaseResults();
  if (route.view === 'mechanisms') updateMechanismDetails();
  if (route.view === 'sources') updateSourceResults();
  if (route.view === 'usage') updateUsageDetails();
  if (route.view === 'builder') { updateBuilderCount(); updateSelectedExamples(); updateBuilderOutput(); }
  if (route.id && ['showcase', 'usage', 'mechanisms'].includes(route.view)) {
    const exists = route.view === 'showcase' ? catalog.showcase.some(item => item.id === route.id) : route.view === 'usage' ? catalog.usage.some(item => item.id === route.id) : catalog.mechanisms.some(item => item.name === route.id);
    if (!exists) notify('That record was not found. Showing the collection instead.');
  }
  if (focus) {
    document.getElementById('route-heading')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function moveShowcase(direction) {
  const records = filteredShowcase();
  const index = Math.max(0, Math.min(records.length - 1, state.showcase.index + direction));
  if (index === state.showcase.index) return;
  state.showcase.index = index;
  state.showcase.revealed = false;
  if (records[index]) setRecordHash('showcase', records[index].id);
  updateShowcaseResults();
  document.querySelector(`[data-action="showcase-${direction < 0 ? 'prev' : 'next'}"]:not(:disabled)`)?.focus({ preventScroll: true });
}

function moveUsage(direction) {
  state.usageIndex = Math.max(0, Math.min(catalog.usage.length - 1, state.usageIndex + direction));
  if (catalog.usage[state.usageIndex]) setRecordHash('usage', catalog.usage[state.usageIndex].id);
  updateUsageDetails();
}

async function handleAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action: name, id } = button.dataset;
  const record = id ? catalog.showcase.find(item => item.id === id) : null;
  switch (name) {
    case 'showcase-layout':
      state.showcase.layout = button.dataset.layout;
      state.showcase.revealed = false;
      updateShowcaseResults();
      break;
    case 'showcase-prev': moveShowcase(-1); break;
    case 'showcase-next': moveShowcase(1); break;
    case 'showcase-reset':
      state.showcase.search = ''; state.showcase.scope = 'all'; state.showcase.index = 0; state.showcase.revealed = false;
      document.getElementById('showcase-search').value = '';
      document.getElementById('showcase-scope').value = 'all';
      updateShowcaseResults();
      document.getElementById('showcase-search').focus();
      break;
    case 'showcase-reveal':
      state.showcase.revealed = true;
      button.setAttribute('aria-expanded', 'true');
      button.parentElement.hidden = true;
      document.getElementById('revealed-joke').hidden = false;
      document.getElementById('revealed-joke').setAttribute('tabindex', '-1');
      document.getElementById('revealed-joke').focus({ preventScroll: true });
      break;
    case 'copy-joke': if (record) await copyText(record.text, 'Joke copied.'); break;
    case 'share-joke': if (record) await shareRecord(record); break;
    case 'headline-use':
      if (record) { state.builder.headlines = record.headline; markBuilderChanged(); window.location.hash = '/builder'; }
      break;
    case 'mechanism-prev': state.mechanismIndex = Math.max(0, state.mechanismIndex - 1); updateMechanismDetails(); setRecordHash('mechanisms', catalog.mechanisms[state.mechanismIndex].name); break;
    case 'mechanism-next': state.mechanismIndex = Math.min(catalog.mechanisms.length - 1, state.mechanismIndex + 1); updateMechanismDetails(); setRecordHash('mechanisms', catalog.mechanisms[state.mechanismIndex].name); break;
    case 'mechanism-select': state.mechanismIndex = Number(button.dataset.index); updateMechanismDetails(); setRecordHash('mechanisms', catalog.mechanisms[state.mechanismIndex].name); break;
    case 'mechanism-use': state.builder.mechanism = catalog.mechanisms[state.mechanismIndex].name; markBuilderChanged(); window.location.hash = '/builder'; break;
    case 'source-use':
      if (!state.builder.exampleIds.includes(id)) {
        if (state.builder.exampleIds.length >= 4) { notify('You have four examples already. Remove one in the prompt builder to add another.'); break; }
        state.builder.exampleIds.push(id);
      }
      markBuilderChanged();
      window.location.hash = '/builder';
      break;
    case 'source-reset':
      state.sources.search = state.sources.mechanism = state.sources.topic = ''; state.sources.limit = 12;
      document.getElementById('source-search').value = '';
      document.getElementById('source-mechanism').value = '';
      document.getElementById('source-topic').value = '';
      updateSourceResults(); document.getElementById('source-search').focus();
      break;
    case 'source-more': {
      const firstNewIndex = state.sources.limit;
      state.sources.limit += 12;
      updateSourceResults();
      const firstNewCard = document.querySelectorAll('[data-testid="source-card"]')[firstNewIndex];
      if (firstNewCard) { firstNewCard.setAttribute('tabindex', '-1'); firstNewCard.focus(); }
      break;
    }
    case 'usage-prev': moveUsage(-1); break;
    case 'usage-next': moveUsage(1); break;
    case 'share-usage': await shareRecord(catalog.usage[state.usageIndex], 'usage'); break;
    case 'copy-recorded-prompt': await copyText(catalog.usage[state.usageIndex][button.dataset.stage]?.[button.dataset.promptKind] || '', 'Recorded prompt copied.'); break;
    case 'builder-add-example': {
      const selected = document.getElementById('builder-example-add').value;
      if (!selected) { notify('Choose a source example first.'); break; }
      if (state.builder.exampleIds.includes(selected)) { notify('That example is already selected.'); break; }
      if (state.builder.exampleIds.length >= 4) { notify('Choose up to four source examples. Remove one before adding another.'); break; }
      state.builder.exampleIds.push(selected); markBuilderChanged(); updateSelectedExamples();
      document.getElementById('builder-example-add').value = '';
      notify('Source example added.');
      break;
    }
    case 'builder-remove-example': state.builder.exampleIds = state.builder.exampleIds.filter(item => item !== id); markBuilderChanged(); updateSelectedExamples(); document.getElementById('builder-example-add').focus(); break;
    case 'builder-clear': {
      const save = false;
      Object.assign(state.builder, { headlines: '', language: 'sk', word1: '', word2: '', context: '', mechanism: '', exampleIds: [], save, output: '', builtRows: [], error: '', stale: false });
      persistDraft();
      renderRoute({ focus: false });
      document.getElementById('builder-headlines').focus();
      notify('Draft cleared from this page and this device.');
      break;
    }
    case 'builder-copy': if (state.builder.output) await copyText(state.builder.output, 'Prompt pack copied.'); break;
    case 'builder-download': if (state.builder.output) downloadText(state.builder.output, `mwahaha-prompts-${state.builder.builtLanguageCode}.txt`); break;
    case 'builder-tsv': if (state.builder.builtRows.length) downloadText(toDelimited(state.builder.builtRows, '\t'), `headlines-${state.builder.builtLanguageCode}.tsv`, 'text/tab-separated-values;charset=utf-8'); break;
    case 'builder-csv': if (state.builder.builtRows.length) downloadText('\ufeff' + toDelimited(state.builder.builtRows, ','), `headlines-${state.builder.builtLanguageCode}.csv`, 'text/csv;charset=utf-8'); break;
    case 'retry-load': window.location.reload(); break;
  }
}

function handleInput(event) {
  const { id, value } = event.target;
  if (id === 'showcase-search') { state.showcase.search = value; state.showcase.index = 0; state.showcase.revealed = false; updateShowcaseResults(); }
  if (id === 'source-search') { state.sources.search = value; state.sources.limit = 12; updateSourceResults(); }
  const fields = { 'builder-headlines': 'headlines', 'builder-word1': 'word1', 'builder-word2': 'word2', 'builder-context': 'context' };
  if (fields[id]) { state.builder[fields[id]] = value; markBuilderChanged(); if (id === 'builder-headlines') updateBuilderCount(); }
}

function handleChange(event) {
  const { id, value } = event.target;
  if (id === 'showcase-scope') { state.showcase.scope = value; state.showcase.index = 0; state.showcase.revealed = false; updateShowcaseResults(); }
  if (id === 'showcase-picker') {
    state.showcase.index = Number(value); state.showcase.revealed = false;
    const record = filteredShowcase()[state.showcase.index];
    if (record) setRecordHash('showcase', record.id);
    updateShowcaseResults(); document.getElementById('showcase-picker').focus({ preventScroll: true });
  }
  if (id === 'mechanism-picker') { state.mechanismIndex = Number(value); updateMechanismDetails(); setRecordHash('mechanisms', catalog.mechanisms[state.mechanismIndex].name); }
  if (id === 'source-mechanism' || id === 'source-topic') { state.sources[id === 'source-mechanism' ? 'mechanism' : 'topic'] = value; state.sources.limit = 12; updateSourceResults(); }
  if (id === 'usage-picker') { state.usageIndex = Number(value); setRecordHash('usage', catalog.usage[state.usageIndex].id); updateUsageDetails(); }
  if (id === 'builder-language' || id === 'builder-mechanism') { state.builder[id === 'builder-language' ? 'language' : 'mechanism'] = value; markBuilderChanged(); }
  if (id === 'builder-save') {
    state.builder.save = event.target.checked;
    const saved = persistDraft();
    if (saved) document.getElementById('builder-status').textContent = state.builder.save ? 'Draft saved on this device.' : 'Saved draft removed from this device.';
  }
}

async function initialize() {
  app = document.getElementById('app');
  document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); document.getElementById('main-content').focus(); });
  app.addEventListener('click', event => { handleAction(event).catch(() => notify('That action could not be completed. Please try again.')); });
  app.addEventListener('input', handleInput);
  app.addEventListener('change', handleChange);
  app.addEventListener('submit', event => { if (event.target.id === 'builder-form') { event.preventDefault(); submitBuilder(); } });
  try {
    const response = await fetch(new URL('./data/catalog.json', import.meta.url));
    if (!response.ok) throw new Error(`Data request failed (${response.status})`);
    catalog = await response.json();
    if (!catalog || !['jokes', 'mechanisms', 'showcase', 'usage'].every(key => Array.isArray(catalog[key])) || !catalog.mechanisms.length) throw new Error('Collection data is incomplete');
    loadDraft();
    renderRoute({ focus: false });
    window.addEventListener('hashchange', () => renderRoute());
  } catch {
    app.setAttribute('aria-busy', 'false');
    app.innerHTML = `<div class="error-state" role="alert"><span class="eyebrow">A SMALL INTERRUPTION</span><h1 id="route-heading">The collection couldn’t load.</h1><p>Please check your connection and try again. You can also read the research or download the collection directly.</p><div class="actions" style="justify-content:center">${action('retry-load', 'Try again', '', 'primary')}<a class="button" href="./downloads/showcase-full.tsv" download>Download the jokes</a><a class="button quiet" href="${REPOSITORY}" target="_blank" rel="noopener noreferrer">Open the repository <span aria-hidden="true">↗</span></a></div></div>`;
  }
}

if (typeof document !== 'undefined') initialize();
