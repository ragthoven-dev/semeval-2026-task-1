import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Loading a data URL keeps the browser's ES module independent of package.json.
const source = await readFile(new URL('../site/prompt-builder.js', import.meta.url), 'utf8');
const { MAX_HEADLINES, parseHeadlines, parseHeadlineFile, buildPromptPack, toDelimited } =
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('headline parsing preserves Unicode and duplicates with distinct identifiers', () => {
  assert.deepEqual(parseHeadlines('\uFEFF  Žiaci skúmajú hviezdy  \r\n\r\nŽiaci skúmajú hviezdy\n中文新闻'), [
    { id: 'custom_001', headline: 'Žiaci skúmajú hviezdy', word1: '-', word2: '-' },
    { id: 'custom_002', headline: 'Žiaci skúmajú hviezdy', word1: '-', word2: '-' },
    { id: 'custom_003', headline: '中文新闻', word1: '-', word2: '-' },
  ]);
});

test('empty input, excessive batches, and incomplete required pairs fail clearly', () => {
  assert.equal(MAX_HEADLINES, 50);
  assert.throws(() => parseHeadlines('\n  \n'), /at least one headline/u);
  assert.throws(() => parseHeadlines(Array(51).fill('News').join('\n')), /at most 50/u);
  assert.equal(parseHeadlines(Array(50).fill('News').join('\n')).length, 50);
  assert.throws(() => parseHeadlines('News', { word1: 'coffee' }), /both required words/u);
  assert.throws(() => parseHeadlines('News', { word1: '-', word2: 'tea' }), /both required words/u);
  assert.throws(() => parseHeadlines('News', { word1: 'a\nb', word2: 'c' }), /one line/u);
  assert.deepEqual(parseHeadlines('News', { word1: '  čaj ', word2: ' káva  ' })[0], {
    id: 'custom_001', headline: 'News', word1: 'čaj', word2: 'káva',
  });
});

test('CSV and TSV quote delimiters, quotation marks and multiline Unicode fields', () => {
  const rows = [{ id: 'custom_001', headline: 'Žiak, "vedec"\nDruhý\triadok', word1: '-', word2: '-' }];
  assert.equal(toDelimited(rows), 'id,headline,word1,word2\ncustom_001,"Žiak, ""vedec""\nDruhý\triadok",-,-\n');
  assert.equal(toDelimited(rows, '\t'), 'id\theadline\tword1\tword2\ncustom_001\t"Žiak, ""vedec""\nDruhý\triadok"\t-\t-\n');
  assert.deepEqual(parseHeadlineFile(toDelimited(rows)), rows);
  assert.deepEqual(parseHeadlineFile(toDelimited(rows, '\t')), rows);
  assert.throws(() => toDelimited(rows, ';'), /comma or tab/u);
});

test('file import regenerates identifiers, handles required pairs, and preserves plain commas', () => {
  assert.deepEqual(parseHeadlineFile('id,headline,word1,word2\nold,"School, new term",tea,coffee\nold,Second story,-,-\n'), [
    { id: 'custom_001', headline: 'School, new term', word1: 'tea', word2: 'coffee' },
    { id: 'custom_002', headline: 'Second story', word1: '-', word2: '-' },
  ]);
  assert.equal(parseHeadlineFile('School, new term\nAnother headline')[0].headline, 'School, new term');
  assert.equal(parseHeadlineFile('headline\nNews', { word1: 'a', word2: 'b' })[0].word2, 'b');
  assert.throws(() => parseHeadlineFile('headline,word1\nNews,tea'), /both word1 and word2/u);
  assert.throws(() => parseHeadlineFile('headline,word1,word2\nNews,tea,'), /both required words/u);
  assert.throws(() => parseHeadlineFile('id,headline\nx,"News'), /closing quote/u);
  assert.throws(() => parseHeadlineFile('id,headline\nx,News,extra'), /expected 2/u);
  assert.throws(() => parseHeadlineFile('headline,headline\nNews,More'), /unique/u);
});

test('prompt pack includes every headline, exact required words, and all four stages', () => {
  const rows = parseHeadlines('Univerzita otvorila knižnicu\nVýskumníci objavili časticu', { word1: 'čaj', word2: 'káva' });
  const pack = buildPromptPack({ rows, context: 'UK means Univerzita Komenského.' });
  for (const row of rows) {
    assert.ok(pack.includes(JSON.stringify(row.headline)));
    assert.ok(pack.includes(row.id));
  }
  for (const stage of ['Planner:', 'Writer:', 'Reflector:', 'Judge:']) assert.ok(pack.includes(stage));
  assert.match(pack, /Slovak \(sk\)/u);
  assert.match(pack, /same clause/u);
  assert.match(pack, /"čaj"/u);
  assert.match(pack, /"káva"/u);
  assert.match(pack, /1–3 short sentences/u);
  assert.match(pack, /Use no semicolons/u);
  assert.match(pack, /Do not invent real-world allegations/u);
  assert.match(pack, /manually selected/u);
  assert.match(pack, /not the result of an actual vector search/u);
  assert.match(pack, /id\ttext\n$/u);
  assert.ok(pack.includes('UK means Univerzita Komenského.'));
});

test('language choices include aliases and a Chinese anchor suited to its writing system', () => {
  const rows = parseHeadlines('大学开设新课程');
  for (const [language, expected] of [['en', 'English'], ['es', 'Spanish'], ['Español', 'Spanish'], ['Slovak', 'Slovak'], ['中文', 'Chinese']]) {
    assert.ok(buildPromptPack({ rows, language }).includes(`in ${expected}`));
  }
  const chinese = buildPromptPack({ rows, language: 'zh' });
  assert.match(chinese, /does not use spaces as reliable word boundaries/u);
  assert.match(chinese, /exact, meaningful headline term/u);
  assert.throws(() => buildPromptPack({ rows, language: 'xx' }), /Choose Slovak/u);
});

test('selected library guidance retains provenance and inputs are never mutated', () => {
  const rows = Object.freeze([Object.freeze({ id: 'mine', headline: 'Žiaci vyhrali súťaž', word1: '-', word2: '-' })]);
  const mechanisms = Object.freeze([Object.freeze({ name: 'ROLE_REVERSAL', desc: 'Swap expected roles.', ex1: 'Reference joke.' })]);
  const examples = Object.freeze([Object.freeze({ joke: 'Example joke', summary: 'An example', mechanism: 'reversal', topic: 'school', source: 'https://example.org/joke' })]);
  const before = JSON.stringify({ rows, mechanisms, examples });
  const pack = buildPromptPack({ rows, mechanisms, examples });
  toDelimited(rows);
  assert.equal(JSON.stringify({ rows, mechanisms, examples }), before);
  for (const field of ['Example joke', 'An example', 'reversal', 'school', 'https://example.org/joke', 'ROLE_REVERSAL']) assert.ok(pack.includes(field));
  assert.throws(() => buildPromptPack({ rows: [] }), /at least one/u);
  assert.throws(() => buildPromptPack({ rows: [...rows, ...rows] }), /unique identifier/u);
  assert.throws(() => buildPromptPack({ rows, examples: {} }), /arrays/u);
});
