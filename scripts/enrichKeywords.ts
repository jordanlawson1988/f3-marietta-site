/**
 * One-shot script: enrich keywords in all lexicon/exicon markdown files
 * with synonyms, plurals/singulars, and semantic variations.
 *
 * Run: npx tsx scripts/enrichKeywords.ts
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'data', 'content');
const FOLDERS = ['lexicon', 'exicon'];

// ---------------------------------------------------------------------------
// F3-specific synonym map: title (lowercase) → extra keywords to add
// ---------------------------------------------------------------------------

const SYNONYM_MAP: Record<string, string[]> = {
  // Lexicon — culture / roles / places
  'ao': ['area of operations', 'location', 'site', 'where', 'workout location', 'workout spot', 'meeting place'],
  'pax': ['participants', 'men', 'guys', 'members', 'people', 'attendance', 'attendees', 'participant'],
  'q': ['leader', 'lead', 'workout leader', 'coach', 'in charge', 'leading', 'caller'],
  'fng': ['new guy', 'newbie', 'first timer', 'first time', 'new member', 'newcomer', 'beginner', 'rookie', 'never been'],
  'backblast': ['recap', 'summary', 'report', 'write up', 'writeup', 'after action', 'workout report', 'post report', 'field report'],
  'cot': ['circle of trust', 'closing', 'end', 'prayer', 'wrap up', 'finish', 'ending', 'close out'],
  'eh': ['emotional headlock', 'recruit', 'recruiting', 'invite', 'invitation', 'bring a friend', 'convince'],
  'hc': ['hard commit', 'commitment', 'committed', 'rsvp', 'promise', 'confirm', 'confirmed'],
  'him': ['high impact man', 'leader', 'man of impact', 'high impact'],
  'gloom': ['early morning', 'dark', 'darkness', 'before dawn', 'predawn', 'morning', '5am', '0530', '5:30'],
  'fartsack': ['bed', 'sleep', 'sleeping in', 'skip', 'skipping', 'lazy', 'stay in bed', 'oversleep', 'snooze'],
  'kotters': ['welcome back', 'return', 'returning', 'came back', 'comeback', 'absent', 'missing', 'been away', 'long time', 'havent been', 'gone awhile'],
  'sad clown': ['alone', 'isolated', 'working out alone', 'solo', 'by yourself', 'no community', 'lonely'],
  'post': ['attend', 'show up', 'showed up', 'attendance', 'showing up', 'participate', 'go to workout'],
  'beatdown': ['workout', 'exercise session', 'session', 'training', 'bootcamp', 'boot camp'],
  'coupon': ['weight', 'block', 'cinder block', 'cinderblock', 'sandbag', 'equipment', 'rock', 'ruck weight'],
  'mary': ['ab exercises', 'abs', 'core work', 'core exercises', 'ab circuit', 'core time'],
  'the thang': ['main workout', 'main event', 'body of workout', 'main exercise', 'main portion'],
  'warm-a-rama': ['warmup', 'warm up', 'stretching', 'warmups', 'warm ups'],
  'mumble chatter': ['talking', 'complaining', 'chatter', 'banter', 'griping', 'grumbling', 'noise'],
  'convergence': ['combined workout', 'meetup', 'all regions', 'gathering', 'joint workout', 'mega workout', 'big event'],
  'csaup': ['challenge', 'special event', 'tough event', 'endurance', 'hard workout', 'extreme', 'gut check'],
  'ruck': ['rucking', 'rucksack', 'backpack', 'weighted walk', 'hiking', 'weighted hike', 'weighted pack'],
  'coffeeteria': ['coffee', 'fellowship', 'after workout', 'hanging out', 'breakfast', '2nd f', 'second f'],
  'pre-blast': ['announcement', 'preview', 'heads up', 'advance notice', 'upcoming', 'next workout'],
  'name-a-rama': ['introductions', 'names', 'introduce', 'who are you', 'roll call', 'name call'],
  'vq': ['virgin q', 'first q', 'first time leading', 'first time q', 'never led', 'new leader'],
  'site q': ['location leader', 'ao leader', 'site leader', 'ao manager'],
  'nantan': ['regional leader', 'region leader', 'boss', 'head', 'top leader', 'in charge'],
  'downrange': ['travel', 'visiting', 'away', 'different region', 'out of town', 'another ao', 'visit'],
  'f3versary': ['anniversary', 'milestone', 'year', 'birthday', 'celebration'],
  'shield lock': ['close group', 'inner circle', 'accountability group', 'small group', 'trusted men', 'brothers'],
  'the standard': ['consistency', 'showing up', 'commitment', 'routine', 'discipline', 'regular'],
  'pick up the six': ['help the last', 'dont leave behind', 'slowest', 'back of pack', 'last man', 'no one left'],
  'the six': ['last person', 'back of pack', 'slowest', 'rear', 'behind'],
  'the shovel flag': ['flag', 'symbol', 'logo', 'emblem', 'marker', 'shovel'],
  'count-a-rama': ['head count', 'counting', 'how many', 'number', 'total pax'],
  'omaha': ['audible', 'change plan', 'modify', 'adjust', 'pivot', 'switch up'],
  'm': ['wife', 'spouse', 'significant other', 'partner', 'married', 'marriage'],
  '2.0': ['kid', 'child', 'son', 'daughter', 'children', 'kids', 'offspring'],
  'respect': ['handshake', 'greeting', 'fist bump', 'acknowledgment', 'hello'],
  'clown car': ['carpool', 'ride', 'driving together', 'ride share', 'car pool'],
  'yhc': ['your humble correspondent', 'author', 'writer', 'i', 'me', 'myself', 'the writer'],
  'jailbreak': ['sprint', 'free run', 'scatter', 'go fast', 'race', 'all out'],
  'speed for need': ['help slower', 'circle back', 'encourage', 'pace', 'come back for'],
  't-claps': ['kudos', 'props', 'respect', 'nice job', 'well done', 'good job', 'congrats', 'congratulations', 'twitter claps'],
  'whetstone': ['sharpen', 'mentoring', 'mentor', 'growth', 'development', 'iron sharpens iron'],
  'the red carpet': ['welcome', 'greeting', 'greet', 'introduction', 'first impression'],
  'the 43 feet': ['proximity', 'close', 'nearby', 'local', 'neighborhood', 'next door'],
  'daily red pill': ['truth', 'reality', 'wake up', 'awareness', 'uncomfortable truth', 'drp'],
  'qsource': ['leadership', 'curriculum', 'training', 'study', 'q source', 'leadership guide', 'manual'],
  'iron sharpens iron': ['accountability', 'growth', 'challenge', 'sharpen', 'mutual', 'together'],
  'slack': ['chat', 'messaging', 'app', 'communication', 'text', 'channel'],
  'give it away': ['service', 'serve', 'help others', 'volunteer', 'give back', 'community service'],
  'living third': ['others first', 'selfless', 'service', 'put others first', 'third f'],
  'shared suffering': ['together', 'misery', 'hard together', 'suffer', 'bonding', 'brotherhood'],
  'no man left behind': ['together', 'unity', 'help', 'support', 'team', 'dont quit'],
  'male isolation': ['loneliness', 'lonely', 'disconnected', 'alone', 'isolation', 'no friends'],
  'kinging': ['self centered', 'selfish', 'ego', 'pride', 'me first'],
  'accelerating': ['growing', 'expanding', 'more', 'increasing', 'ramping up'],
  'decelerating': ['slowing', 'shrinking', 'less', 'declining', 'falling off'],
  'double hate': ['love', 'affection', 'respect', 'admiration', 'tough love'],
  'liquid sunshine': ['rain', 'raining', 'wet', 'weather', 'drizzle', 'downpour', 'storm'],
  'dredd': ['hard', 'brutal', 'tough', 'intense', 'feared', 'dreaded'],
  'dark helmet': ['overtime', 'extra', 'before workout', 'pre workout', 'early arrival'],

  // Exicon — exercises
  'merkin': ['pushup', 'push up', 'push-up', 'pushups', 'push ups', 'push-ups', 'chest exercise'],
  'ssh': ['side straddle hop', 'jumping jack', 'jumping jacks', 'star jump', 'star jumps', 'cardio warmup'],
  'imperial walker': ['high knees', 'high knee', 'knee raise', 'knee raises', 'marching'],
  'lbc': ['little baby crunch', 'little baby crunches', 'crunches', 'crunch', 'ab crunch', 'abs'],
  'burpee': ['burpees', 'up down', 'squat thrust', 'squat thrusts', 'full body'],
  'flutter kicks': ['flutter', 'flutters', 'leg raises', 'ab exercise', 'leg flutter'],
  'al gore': ['wall sit', 'wall sits', 'squat hold', 'static squat', 'hold squat', 'invisible chair'],
  'american hammer': ['russian twist', 'twists', 'oblique', 'obliques', 'torso twist', 'ab twist'],
  'bear crawl': ['crawl', 'crawling', 'hands and feet', 'all fours', 'bear'],
  'carolina dry dock': ['pike pushup', 'pike push up', 'shoulder pushup', 'decline pushup', 'pike'],
  'big boy sit-up': ['sit up', 'situp', 'sit ups', 'situps', 'full sit up', 'big boy'],
  'bobby hurley': ['squat press', 'squat to press', 'thruster', 'squat jump reach'],
  'bonnie blair': ['lunge jump', 'jump lunge', 'jumping lunge', 'switch lunge', 'alternating lunge jump'],
  'box cutter': ['v up', 'v-up', 'v ups', 'jackknife', 'leg raise', 'pike crunch'],
  'box jumps': ['box jump', 'jump up', 'step up jump', 'plyometric', 'plyo'],
  'burpee broad jump': ['burpee jump', 'broad jump burpee', 'jump forward burpee'],
  'cherry pickers': ['cherry picker', 'toe touch', 'toe touches', 'stretch', 'hamstring'],
  'copperhead squat': ['squat hold', 'isometric squat', 'squat pause', 'hold at bottom'],
  'crab walk': ['crab', 'backward crawl', 'reverse crawl', 'hands behind'],
  'crawl bear': ['reverse bear crawl', 'backward bear crawl', 'bear crawl backward'],
  'derkin': ['decline pushup', 'decline push up', 'feet elevated pushup', 'elevated merkin'],
  'diamond merkin': ['diamond pushup', 'diamond push up', 'close grip pushup', 'triangle pushup', 'narrow pushup'],
  'dips': ['dip', 'tricep dip', 'tricep dips', 'bench dip', 'bench dips', 'triceps'],
  'dying cockroach': ['dead bug', 'dead bugs', 'flailing', 'back exercise', 'supine'],
  'freddy mercury': ['scissor kick', 'scissors', 'flutter', 'leg scissors', 'alternating legs'],
  'gorilla crawl': ['ape crawl', 'gorilla walk', 'primate walk'],
  'groiners': ['groiner', 'mountain climber variation', 'hip stretch', 'groin stretch'],
  'hand release merkin': ['hand release pushup', 'hand release push up', 'chest to ground pushup', 'dead stop pushup'],
  'hello dollies': ['hello dolly', 'leg spread', 'leg spreads', 'open close legs', 'ab exercise'],
  'hillbillies': ['hillbilly', 'squat walk', 'lateral walk', 'side step squat'],
  'irkin': ['incline pushup', 'incline push up', 'incline merkin', 'elevated hands pushup'],
  'iron mike': ['lunge', 'walking lunge', 'forward lunge', 'step lunge', 'alternating lunge'],
  'j-lo': ['hip raise', 'hip thrust', 'hip raises', 'glute raise', 'booty exercise'],
  'monkey humpers': ['monkey humper', 'hip hinge', 'air hump', 'hip thrust standing'],
  'moroccan night club': ['arm exercise', 'arm circles', 'wrist rotation', 'forearm exercise', 'arm burn'],
  'mountain climber': ['mountain climbers', 'running plank', 'plank run', 'knee drive'],
  'overhead claps': ['overhead clap', 'clap overhead', 'arm raise clap', 'hands up clap'],
  'parker peter': ['reverse peter parker', 'plank kick', 'cross body plank'],
  'peoples chair': ["people's chair", 'wall sit', 'chair', 'back against wall', 'invisible chair'],
  'peter parker': ['spiderman', 'spider man', 'plank knee', 'cross body knee'],
  'plank jacks': ['plank jack', 'jumping plank', 'plank hops', 'plank jumps'],
  'rosalitas': ['rosalita', 'arm exercise', 'lateral raise', 'shoulder raise'],
  'seal claps': ['seal clap', 'front clap', 'chest clap', 'arm clap'],
  'smurf jacks': ['smurf jack', 'squat jack', 'squat jumping jack', 'low jack'],
  'step ups': ['step up', 'bench step', 'box step up', 'step exercise'],
  't-merkin': ['t pushup', 't push up', 'rotation pushup', 'side plank pushup'],
  'wojos': ['wojo', 'shoulder tap pushup', 'arm raise pushup'],
  'squats': ['squat', 'air squat', 'bodyweight squat', 'body weight squat', 'deep squat'],
  'lunges': ['lunge', 'walking lunge', 'walking lunges', 'forward lunge', 'reverse lunge', 'step lunge'],
  'plank': ['planks', 'plank hold', 'hold plank', 'isometric', 'static hold'],
  'jump squats': ['jump squat', 'squat jump', 'squat jumps', 'explosive squat', 'plyometric squat'],
  'overhead press': ['ohp', 'shoulder press', 'military press', 'press overhead', 'standing press'],
  'curls': ['curl', 'bicep curl', 'bicep curls', 'arm curl', 'arm curls'],
  'skull crushers': ['skull crusher', 'tricep extension', 'tricep extensions', 'lying tricep', 'french press'],
  'bent over row': ['bent row', 'row', 'rows', 'back row', 'coupon row', 'pull'],
  'chest press': ['bench press', 'floor press', 'coupon press', 'lying press'],
  'blockees': ['blockee', 'block burpee', 'coupon burpee', 'block exercise'],
  'don quixote': ['don quixotes', 'arm circles', 'arm circle', 'windmills', 'shoulder circles'],
  'wide arm merkin': ['wide merkin', 'wide pushup', 'wide push up', 'wide grip pushup', 'chest pushup'],
  'ranger merkin': ['clap pushup', 'clap push up', 'explosive pushup', 'power pushup', 'plyo pushup'],
  'sumo squat': ['sumo squats', 'wide squat', 'wide stance squat', 'plie squat', 'inner thigh squat'],
  'shoulder taps': ['shoulder tap', 'plank tap', 'plank taps', 'anti rotation'],
  'toy soldiers': ['toy soldier', 'leg kick', 'leg kicks', 'straight leg kick', 'hamstring kick'],
  'superman': ['supermans', 'back extension', 'back extensions', 'prone extension', 'lower back'],
  'glute bridge': ['glute bridges', 'hip bridge', 'hip bridges', 'bridge', 'bridges', 'hip raise'],
  'windmill': ['windmills', 'cross touch', 'toe touch twist', 'rotational stretch'],
  'calf raises': ['calf raise', 'heel raise', 'heel raises', 'toe raise', 'toe raises', 'calves'],
  'michael phelps': ['arm swing', 'arm swings', 'swimmer', 'backstroke', 'arm warmup'],
};

// ---------------------------------------------------------------------------
// Auto-generate plural/singular variations from a title
// ---------------------------------------------------------------------------

function generatePlurals(title: string): string[] {
  const t = title.toLowerCase();
  const extras: string[] = [];

  // If ends in 's', add singular
  if (t.endsWith('ies')) {
    extras.push(t.slice(0, -3) + 'y');
  } else if (t.endsWith('es') && !t.endsWith('oes')) {
    extras.push(t.slice(0, -2));
    extras.push(t.slice(0, -1));
  } else if (t.endsWith('s') && !t.endsWith('ss')) {
    extras.push(t.slice(0, -1));
  }

  // If doesn't end in 's', add plural
  if (!t.endsWith('s')) {
    extras.push(t + 's');
    if (t.endsWith('y')) {
      extras.push(t.slice(0, -1) + 'ies');
    }
  }

  // Handle abbreviations — add with/without periods
  if (/^[A-Z]{2,}$/i.test(title)) {
    extras.push(title.split('').join('.').toLowerCase() + '.');
  }

  return extras.filter(e => e !== t && e.length > 2);
}

// ---------------------------------------------------------------------------
// Process a single file
// ---------------------------------------------------------------------------

function processFile(filePath: string): { updated: boolean; added: number } {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const title = typeof data.title === 'string' ? data.title : '';
  if (!title) return { updated: false, added: 0 };

  const existing: string[] = Array.isArray(data.keywords)
    ? data.keywords.map((k: unknown) => String(k).toLowerCase())
    : [];

  const existingSet = new Set(existing);

  // Gather new keywords
  const toAdd: string[] = [];

  // 1. Plurals/singulars from title
  for (const p of generatePlurals(title)) {
    if (!existingSet.has(p)) toAdd.push(p);
  }

  // 2. Synonym map lookup
  const key = title.toLowerCase();
  const synonyms = SYNONYM_MAP[key] ?? [];
  for (const s of synonyms) {
    if (!existingSet.has(s.toLowerCase())) toAdd.push(s.toLowerCase());
  }

  // 3. Also check aliases for synonym matches
  const aliases: string[] = Array.isArray(data.aliases)
    ? data.aliases.map((a: unknown) => String(a).toLowerCase())
    : [];
  for (const alias of aliases) {
    const aliasSynonyms = SYNONYM_MAP[alias] ?? [];
    for (const s of aliasSynonyms) {
      if (!existingSet.has(s.toLowerCase()) && !toAdd.includes(s.toLowerCase())) {
        toAdd.push(s.toLowerCase());
      }
    }
    // Add the alias itself as a keyword if not present
    if (!existingSet.has(alias) && !toAdd.includes(alias) && alias.length > 2) {
      toAdd.push(alias);
    }
  }

  if (toAdd.length === 0) return { updated: false, added: 0 };

  // Merge and deduplicate
  const merged = [...existing, ...toAdd];
  const unique = [...new Set(merged)].filter(k => k.length > 0);
  data.keywords = unique;

  // Rebuild the file
  const newRaw = matter.stringify(content, data);
  fs.writeFileSync(filePath, newRaw, 'utf-8');

  return { updated: true, added: toAdd.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('Enriching keywords across all content files...\n');

  let totalFiles = 0;
  let totalUpdated = 0;
  let totalAdded = 0;

  for (const folder of FOLDERS) {
    const dir = path.join(CONTENT_DIR, folder);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.md') && f !== 'README.md');

    console.log(`${folder}: ${files.length} files`);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const { updated, added } = processFile(filePath);
      totalFiles++;
      if (updated) {
        totalUpdated++;
        totalAdded += added;
      }
    }
  }

  console.log(`\nProcessed ${totalFiles} files`);
  console.log(`Updated ${totalUpdated} files with ${totalAdded} new keywords`);
}

main();
