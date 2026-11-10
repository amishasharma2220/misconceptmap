// A sample student, used by the landing page (demo question, previews) and by tests.
// Deterministic (seeded), so screenshots and tests are stable.
import type {
  DailyActivity,
  PracticeQuestion,
  ReviewItem,
  SessionRecord,
  StudentConcept,
  StudentMisconception,
  StudentSnapshot,
  SubjectCode,
} from './types'

// Placeholder until the official GATE 2027 schedule is set in config.
export const GATE_DATE = '2027-02-06'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
const rand = seeded(20270206)
const round2 = (x: number) => Math.round(x * 100) / 100

type Spec = [slug: string, name: string, prereqs: string[], description: string]

const DSA: Spec[] = [
  ['asymptotic-notation', 'Asymptotic notation', [], 'Growth-rate bounds O, Ω, Θ and comparing functions.'],
  ['recurrence-relations', 'Recurrence relations', ['asymptotic-notation'], 'Writing T(n) for recursive algorithms; substitution and recursion trees.'],
  ['master-theorem', 'Master theorem', ['recurrence-relations'], 'The three cases for T(n) = aT(n/b) + f(n) and when it does not apply.'],
  ['arrays-pointers', 'Arrays and pointers', [], 'Row/column-major addressing and pointer arithmetic in C.'],
  ['recursion-c', 'Recursion in C', ['arrays-pointers'], 'Tracing recursive calls, static variables, parameter passing.'],
  ['linked-lists', 'Linked lists', ['arrays-pointers'], 'Insertion, deletion, reversal, cycle detection.'],
  ['stacks-queues', 'Stacks and queues', ['arrays-pointers'], 'Implementations, circular queues, postfix evaluation.'],
  ['binary-trees', 'Binary trees', ['recursion-c'], 'Traversals, reconstruction from traversals, node-count properties.'],
  ['binary-search-trees', 'Binary search trees', ['binary-trees'], 'Search, insert, delete; height bounds.'],
  ['avl-trees', 'AVL trees', ['binary-search-trees'], 'Balance factor, rotations, minimum nodes for a height.'],
  ['binary-heaps', 'Binary heaps', ['binary-trees', 'asymptotic-notation'], 'Array representation, heapify, build-heap in O(n).'],
  ['hashing', 'Hashing', ['arrays-pointers'], 'Chaining, open addressing, probing, load factor.'],
  ['binary-search', 'Binary search', ['asymptotic-notation'], 'Correct bounds and comparison counts.'],
  ['comparison-sorting', 'Comparison sorting', ['asymptotic-notation'], 'Insertion, selection and bubble sort: swaps and comparisons.'],
  ['merge-sort', 'Merge sort', ['comparison-sorting', 'recurrence-relations'], 'Divide and conquer, merge cost, extra space.'],
  ['quicksort', 'Quicksort', ['comparison-sorting', 'recurrence-relations'], 'Partition schemes, worst-case inputs, pivot choice.'],
  ['heap-sort', 'Heap sort', ['binary-heaps', 'comparison-sorting'], 'Build-heap then repeated extraction; in-place.'],
  ['sorting-stability-inplace', 'Stability and in-place sorting', ['merge-sort', 'quicksort', 'heap-sort'], 'Which sorts are stable, which are in-place, and why those are independent.'],
  ['sorting-lower-bound', 'Sorting lower bound', ['comparison-sorting'], 'The Ω(n log n) decision-tree bound; counting and radix sort.'],
  ['graph-representation', 'Graph representation', [], 'Adjacency matrix vs list trade-offs.'],
  ['bfs-dfs', 'BFS and DFS', ['graph-representation', 'stacks-queues'], 'Traversal order, edge classification, complexity.'],
  ['topological-sort', 'Topological sort', ['bfs-dfs'], 'DFS finishing order and Kahn’s algorithm.'],
  ['minimum-spanning-trees', 'Minimum spanning trees', ['bfs-dfs', 'binary-heaps'], 'Kruskal and Prim; cut and cycle properties.'],
  ['shortest-paths', 'Shortest paths', ['bfs-dfs', 'binary-heaps'], 'Dijkstra, and why negative edges break it; Bellman-Ford.'],
  ['greedy-algorithms', 'Greedy algorithms', ['comparison-sorting'], 'Activity selection, Huffman coding; when greedy fails.'],
  ['dynamic-programming', 'Dynamic programming', ['recursion-c', 'recurrence-relations'], 'Optimal substructure; LCS, 0/1 knapsack, matrix-chain.'],
]

const OS: Spec[] = [
  ['processes-threads', 'Processes and threads', [], 'Process states, PCB, user vs kernel threads.'],
  ['cpu-scheduling', 'CPU scheduling', ['processes-threads'], 'FCFS, SJF, SRTF, round robin, priority; waiting and turnaround time.'],
  ['synchronization', 'Process synchronization', ['processes-threads'], 'Critical sections, Peterson’s solution, hardware support.'],
  ['semaphores', 'Semaphores and monitors', ['synchronization'], 'Counting and binary semaphores; classic problems.'],
  ['deadlocks', 'Deadlocks', ['semaphores'], 'Coffman conditions, resource-allocation graphs.'],
  ['bankers-algorithm', 'Banker’s algorithm', ['deadlocks'], 'Safe states and avoidance.'],
  ['memory-allocation', 'Contiguous allocation', ['processes-threads'], 'First/best/worst fit, fragmentation.'],
  ['paging', 'Paging', ['memory-allocation'], 'Page tables, address translation, multi-level paging.'],
  ['tlb', 'TLB and effective access time', ['paging'], 'TLB hits and misses in EAT calculations.'],
  ['virtual-memory', 'Virtual memory', ['paging'], 'Demand paging, page faults, thrashing.'],
  ['page-replacement', 'Page replacement', ['virtual-memory'], 'FIFO, LRU, optimal; Belady’s anomaly.'],
  ['segmentation', 'Segmentation', ['memory-allocation'], 'Segment tables and segmentation with paging.'],
  ['file-systems', 'File systems', ['memory-allocation'], 'Allocation methods, inodes, directory structures.'],
  ['disk-scheduling', 'Disk scheduling', ['file-systems'], 'FCFS, SSTF, SCAN, C-SCAN, LOOK.'],
]

const DBMS: Spec[] = [
  ['er-model', 'ER model', [], 'Entities, relationships, cardinality and participation.'],
  ['relational-model', 'Relational model', ['er-model'], 'Keys, integrity constraints, ER-to-relational mapping.'],
  ['relational-algebra', 'Relational algebra', ['relational-model'], 'Select, project, joins, division.'],
  ['sql', 'SQL queries', ['relational-algebra'], 'Joins, grouping, nested and correlated queries, NULLs.'],
  ['functional-dependencies', 'Functional dependencies', ['relational-model'], 'Closure, canonical cover, candidate keys.'],
  ['normal-forms', 'Normal forms', ['functional-dependencies'], '1NF to BCNF; lossless and dependency-preserving decomposition.'],
  ['transactions', 'Transactions and ACID', ['sql'], 'Transaction states and properties.'],
  ['serializability', 'Serializability', ['transactions'], 'Conflict and view serializability, precedence graphs.'],
  ['concurrency-control', 'Concurrency control', ['serializability'], '2PL, strict 2PL, timestamp ordering.'],
  ['recoverability', 'Recoverability', ['serializability'], 'Recoverable, cascadeless and strict schedules.'],
  ['indexing', 'Indexing', ['relational-model'], 'Primary, clustering and secondary indexes.'],
  ['b-plus-trees', 'B and B+ trees', ['indexing'], 'Order, fan-out, height and node splits.'],
]

// Hand-set mastery for the concepts the sample story is about; the rest is seeded.
const PINNED: Record<string, number | null> = {
  'sorting-stability-inplace': 0.35,
  'heap-sort': 0.31,
  'binary-heaps': 0.38,
  'master-theorem': 0.29,
  'recurrence-relations': 0.52,
  'asymptotic-notation': 0.86,
  'tlb': 0.27,
  'page-replacement': 0.44,
  'serializability': 0.33,
  'normal-forms': 0.41,
  'shortest-paths': null,
  'b-plus-trees': null,
  'disk-scheduling': null,
  'bankers-algorithm': null,
}

function build(subject: SubjectCode, specs: Spec[]): StudentConcept[] {
  return specs.map(([slug, name, prereqs, description]) => {
    const pinned = slug in PINNED ? PINNED[slug] : undefined
    const mastery = pinned !== undefined ? pinned : round2(0.42 + rand() * 0.5)
    const attempts = mastery == null ? 0 : 6 + Math.floor(rand() * 34)
    const end = mastery ?? 0
    const trend = Array.from({ length: 7 }, (_, i) =>
      mastery == null ? 0 : round2(Math.max(0.05, end - (6 - i) * (0.012 + rand() * 0.02))),
    )
    return {
      slug,
      name,
      subject,
      description,
      prereqs,
      mastery,
      attempts,
      accuracy: mastery == null ? null : round2(Math.min(0.97, mastery * 0.85 + 0.12)),
      lastPractisedDays: mastery == null ? null : Math.floor(rand() * 9),
      trend,
    }
  })
}

const concepts: StudentConcept[] = [...build('DSA', DSA), ...build('OS', OS), ...build('DBMS', DBMS)]

const misconceptions: StudentMisconception[] = [
  { id: 1, slug: 'heapsort-is-stable', title: 'Believes heap sort is stable', explanation: 'Sift-down swaps elements that are far apart, so two records with equal keys can change order.', example: 'Sorting (3,a) (3,b) (1,c) with heap sort can output (1,c) (3,b) (3,a).', concept: 'heap-sort', hits: 7, lastSeenDays: 0 },
  { id: 2, slug: 'quicksort-is-stable', title: 'Believes quicksort is stable', explanation: 'Partitioning swaps elements across the array, which can reorder equal keys.', concept: 'quicksort', hits: 5, lastSeenDays: 1 },
  { id: 3, slug: 'master-case2-no-log', title: 'Drops the log factor in master theorem case 2', explanation: 'When f(n) = Θ(n^{log_b a}), the answer is Θ(n^{log_b a} log n), not Θ(n^{log_b a}).', example: 'T(n) = 2T(n/2) + n is Θ(n log n), not Θ(n).', concept: 'master-theorem', hits: 6, lastSeenDays: 2 },
  { id: 4, slug: 'tlb-miss-is-page-fault', title: 'Treats every TLB miss as a page fault', explanation: 'A TLB miss only means the translation is not cached; the page table is consulted and the page is usually still in memory.', concept: 'tlb', hits: 5, lastSeenDays: 1 },
  { id: 5, slug: 'eat-forgets-tlb-time', title: 'Leaves TLB lookup time out of EAT on a miss', explanation: 'On a TLB miss you still paid for the TLB lookup before walking the page table.', concept: 'tlb', hits: 3, lastSeenDays: 4 },
  { id: 6, slug: 'conflict-equals-view', title: 'Thinks view-serializable implies conflict-serializable', explanation: 'It is the other way round: every conflict-serializable schedule is view-serializable, but blind writes can make a schedule view- but not conflict-serializable.', concept: 'serializability', hits: 4, lastSeenDays: 3 },
  { id: 7, slug: 'bcnf-always-dependency-preserving', title: 'Assumes BCNF decomposition always preserves dependencies', explanation: 'BCNF guarantees a lossless join but can lose functional dependencies; 3NF is the one that can always preserve them.', concept: 'normal-forms', hits: 3, lastSeenDays: 6 },
  { id: 8, slug: 'build-heap-n-log-n', title: 'Believes build-heap takes Θ(n log n)', explanation: 'Bottom-up heapify does most work on low levels; the total is Θ(n).', concept: 'binary-heaps', hits: 4, lastSeenDays: 2 },
  { id: 9, slug: 'lru-belady', title: 'Expects Belady’s anomaly under LRU', explanation: 'LRU is a stack algorithm, so adding frames never increases faults; the anomaly happens with FIFO.', concept: 'page-replacement', hits: 2, lastSeenDays: 5 },
]

export const sampleQuestions: PracticeQuestion[] = [
  {
    id: 101, subject: 'DSA', concept: 'sorting-stability-inplace', alsoTests: ['heap-sort', 'quicksort'], source: 'GATE-style, original', difficulty: 2,
    stem: 'An array of $n$ records is sorted by key. Which algorithm **always** keeps records with equal keys in their original relative order?',
    options: [
      { label: 'A', text: 'Heap sort', correct: false, misconception: 1 },
      { label: 'B', text: 'Quicksort (Lomuto partition)', correct: false, misconception: 2 },
      { label: 'C', text: 'Merge sort', correct: true },
      { label: 'D', text: 'Selection sort', correct: false },
    ],
    explanation: 'Merge sort is stable: when keys tie, the merge step takes from the left run first, so equal keys keep their input order. Heap sort, quicksort and the usual selection sort can all reorder equal keys.',
    whyPicked: 'You missed a stability question twice this week',
  },
  {
    id: 102, subject: 'DSA', concept: 'master-theorem', alsoTests: ['recurrence-relations'], source: 'GATE-style, original', difficulty: 2,
    stem: 'What is the solution of the recurrence $T(n) = 2T(n/2) + n$, with $T(1) = 1$?',
    options: [
      { label: 'A', text: '$\\Theta(n)$', correct: false, misconception: 3 },
      { label: 'B', text: '$\\Theta(n \\log n)$', correct: true },
      { label: 'C', text: '$\\Theta(n^2)$', correct: false },
      { label: 'D', text: '$\\Theta(\\log n)$', correct: false },
    ],
    explanation: 'Here $a = 2$, $b = 2$, so $n^{\\log_b a} = n$. Since $f(n) = \\Theta(n)$, this is case 2 and $T(n) = \\Theta(n \\log n)$.',
    whyPicked: 'Weak prerequisite of Merge sort',
  },
  {
    id: 103, subject: 'DSA', concept: 'binary-heaps', alsoTests: ['asymptotic-notation'], source: 'GATE-style, original', difficulty: 3,
    stem: 'What is the worst-case time to build a binary max-heap from an unsorted array of $n$ elements using bottom-up heapify?',
    options: [
      { label: 'A', text: '$\\Theta(\\log n)$', correct: false },
      { label: 'B', text: '$\\Theta(n)$', correct: true },
      { label: 'C', text: '$\\Theta(n \\log n)$', correct: false, misconception: 8 },
      { label: 'D', text: '$\\Theta(n^2)$', correct: false },
    ],
    explanation: 'A node at height $h$ costs $O(h)$, and there are at most $\\lceil n / 2^{h+1} \\rceil$ such nodes. Summing $\\sum_h h\\, n/2^{h+1}$ gives $O(n)$.',
    whyPicked: 'Weak prerequisite of Heap sort',
  },
  {
    id: 104, subject: 'OS', concept: 'tlb', alsoTests: ['paging'], source: 'GATE-style, original', difficulty: 3,
    stem: 'A system has a TLB with hit ratio 0.9. TLB lookup takes 10 ns and a memory access takes 100 ns. With a single-level page table and no page faults, what is the effective memory access time?',
    options: [
      { label: 'A', text: '110 ns', correct: false },
      { label: 'B', text: '120 ns', correct: true },
      { label: 'C', text: '119 ns', correct: false, misconception: 5 },
      { label: 'D', text: 'Undefined: every TLB miss causes a page fault', correct: false, misconception: 4 },
    ],
    explanation: 'EAT $= 0.9(10 + 100) + 0.1(10 + 100 + 100) = 99 + 21 = 120$ ns. A TLB miss costs one extra memory access for the page table, not a page fault.',
    whyPicked: 'Lowest mastery in Operating Systems',
  },
  {
    id: 105, subject: 'DBMS', concept: 'serializability', alsoTests: ['transactions'], source: 'GATE-style, original', difficulty: 3,
    stem: 'Which statement about schedules is **true**?',
    options: [
      { label: 'A', text: 'Every view-serializable schedule is conflict-serializable', correct: false, misconception: 6 },
      { label: 'B', text: 'Every conflict-serializable schedule is view-serializable', correct: true },
      { label: 'C', text: 'Conflict and view serializability are equivalent', correct: false, misconception: 6 },
      { label: 'D', text: 'A schedule with blind writes cannot be view-serializable', correct: false },
    ],
    explanation: 'Conflict serializability is the stricter condition. Blind writes are what allow a schedule to be view-serializable without being conflict-serializable.',
    whyPicked: 'Due for review: wrong 2 times',
  },
  {
    id: 106, subject: 'DSA', concept: 'heap-sort', alsoTests: ['binary-heaps'], source: 'GATE-style, original', difficulty: 2,
    stem: 'Heap sort on an array of $n$ elements uses how much extra space, excluding the input array?',
    options: [
      { label: 'A', text: '$O(1)$', correct: true },
      { label: 'B', text: '$O(\\log n)$', correct: false },
      { label: 'C', text: '$O(n)$', correct: false },
      { label: 'D', text: '$O(n \\log n)$', correct: false },
    ],
    explanation: 'Heap sort builds the heap inside the input array and swaps the maximum to the end each round, so it is in-place: $O(1)$ extra space (iterative sift-down).',
    whyPicked: 'Practising the concept behind your most frequent misconception',
  },
]

function days(n: number): string {
  const d = new Date('2026-11-06T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

const daily: DailyActivity[] = Array.from({ length: 30 }, (_, i) => {
  const n = 29 - i
  const weekend = [0, 6].includes(new Date(days(n)).getUTCDay())
  const questions = Math.round((weekend ? 38 : 22) + rand() * 26 - (n > 20 ? 10 : 0))
  return { date: days(n), questions, accuracy: round2(0.55 + (29 - n) * 0.005 + rand() * 0.12) }
})

const sessions: SessionRecord[] = [
  { id: 41, date: days(0), subject: 'DSA', mode: 'Adaptive', title: 'Adaptive session', questions: 12, correct: 8, minutes: 21, masteryDelta: 0.04 },
  { id: 40, date: days(1), subject: 'OS', mode: 'Adaptive', title: 'Adaptive session', questions: 10, correct: 5, minutes: 19, masteryDelta: -0.02 },
  { id: 39, date: days(1), subject: 'DSA', mode: 'Review', title: 'Review', questions: 6, correct: 4, minutes: 9, masteryDelta: 0.03 },
  { id: 38, date: days(2), subject: 'DBMS', mode: 'Concept', title: 'Concept practice', questions: 8, correct: 5, minutes: 14, masteryDelta: 0.05 },
  { id: 37, date: days(3), subject: 'DSA', mode: 'Adaptive', title: 'Adaptive session', questions: 15, correct: 11, minutes: 27, masteryDelta: 0.06 },
  { id: 36, date: days(4), subject: 'OS', mode: 'Review', title: 'Review', questions: 5, correct: 2, minutes: 8, masteryDelta: -0.01 },
  { id: 35, date: days(5), subject: 'DBMS', mode: 'Adaptive', title: 'Adaptive session', questions: 10, correct: 7, minutes: 17, masteryDelta: 0.03 },
]

const review: ReviewItem[] = [
  { questionId: 105, stem: 'Which statement about schedules is true?', concept: 'serializability', timesWrong: 2, lastAnsweredDays: 3, dueInHours: -5 },
  { questionId: 101, stem: 'Which algorithm always keeps records with equal keys in order?', concept: 'sorting-stability-inplace', timesWrong: 2, lastAnsweredDays: 1, dueInHours: -2 },
  { questionId: 104, stem: 'Effective memory access time with a 0.9 TLB hit ratio', concept: 'tlb', timesWrong: 1, lastAnsweredDays: 1, dueInHours: 0 },
  { questionId: 102, stem: 'Solve T(n) = 2T(n/2) + n', concept: 'master-theorem', timesWrong: 3, lastAnsweredDays: 2, dueInHours: 3 },
  { questionId: 103, stem: 'Worst-case time of bottom-up build-heap', concept: 'binary-heaps', timesWrong: 1, lastAnsweredDays: 2, dueInHours: 6 },
  { questionId: 106, stem: 'Extra space used by heap sort', concept: 'heap-sort', timesWrong: 1, lastAnsweredDays: 4, dueInHours: 20 },
  { questionId: 107, stem: 'Is this BCNF decomposition dependency-preserving?', concept: 'normal-forms', timesWrong: 1, lastAnsweredDays: 6, dueInHours: 30 },
  { questionId: 108, stem: 'Page faults for LRU with 3 frames', concept: 'page-replacement', timesWrong: 2, lastAnsweredDays: 5, dueInHours: 44 },
]

export const sample: StudentSnapshot = {
  subjects: [
    { code: 'DSA', name: 'Data Structures and Algorithms', short: 'DSA' },
    { code: 'OS', name: 'Operating Systems', short: 'OS' },
    { code: 'DBMS', name: 'Databases', short: 'DBMS' },
  ],
  concepts,
  misconceptions,
  questions: sampleQuestions.map(({ id, subject, concept, alsoTests, difficulty, source, stem }) => ({
    id, subject, concept, alsoTests, difficulty, source, stem,
  })),
  sessions,
  daily,
  review,
  totals: {
    answered: daily.reduce((s, d) => s + d.questions, 0) + 286,
    answeredThisWeek: daily.slice(-7).reduce((s, d) => s + d.questions, 0),
    streakDays: 9,
    avgSecondsPerQuestion: 102,
  },
  byDifficulty: [
    { level: 'Level 1', questions: 182, accuracy: 0.86 },
    { level: 'Level 2', questions: 341, accuracy: 0.74 },
    { level: 'Level 3', questions: 402, accuracy: 0.61 },
    { level: 'Level 4', questions: 207, accuracy: 0.47 },
    { level: 'Level 5', questions: 78, accuracy: 0.32 },
  ],
  timeBuckets: [
    { bucket: '< 30s', questions: 96 },
    { bucket: '30–60s', questions: 212 },
    { bucket: '1–2 min', questions: 431 },
    { bucket: '2–3 min', questions: 288 },
    { bucket: '3–5 min', questions: 142 },
    { bucket: '> 5 min', questions: 41 },
  ],
  gateDate: GATE_DATE,
}
