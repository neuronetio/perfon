export const DEFAULT_TIME = 3000; // Default time in milliseconds to run each test
export const DEFAULT_MIN_OP = 100; // Minimum number of operations (test fn calls) to consider the benchmark valid
export const DEFAULT_SEGMENTS_COUNT = 50; // Default number of segments to run the benchmark
const DEFAULT_WARMUP_RATIO = 0.2; // Default ratio for warmup

export interface DefaultValuesOptions {
  warmupRatio: number; // Ratio for warmup
  segmentsCount: number; // Number of segments to run the benchmark
}

const DEFAULT_VALUES_OPTIONS: DefaultValuesOptions = {
  warmupRatio: DEFAULT_WARMUP_RATIO,
  segmentsCount: DEFAULT_SEGMENTS_COUNT,
};

export function defaultValues(
  time: number = DEFAULT_TIME,
  minOp: number = DEFAULT_MIN_OP,
  options: Partial<DefaultValuesOptions> = {}
): BenchmarkOptions {
  const opts = { ...DEFAULT_VALUES_OPTIONS, ...options };
  // warmup time = 0.2 * DEFAULT_TIME for 3000ms default time 3000 * 0.2 = 600ms
  const warmupTime = time * opts.warmupRatio; // Default time in milliseconds to run the warmup
  const warmupMinOp = minOp * opts.warmupRatio; // Minimum number of operations for warmup
  const segmentsCount = opts.segmentsCount; // Default number of chunks to run

  return {
    time,
    minOp,
    warmupTime,
    warmupMinOp,
    segmentsCount,
  };
}

export interface MeasureOptions {
  time: number; // Time in milliseconds to run the test
  minOp: number; // Minimum number of fn calls to consider the benchmark valid
}

export interface SegmentedOptions extends Omit<MeasureOptions, "beforeEach" | "afterEach"> {
  segmentsCount: number;
  beforeEachSegment?: (currentSegmentIndex: number, allSegments: number) => unknown;
  afterEachSegment?: (currentSegmentIndex: number, allSegments: number) => unknown;
}

export interface BenchmarkOptions extends SegmentedOptions {
  warmupTime: number;
  warmupMinOp: number; // Minimum number of fn calls to consider the warmup valid
}

export interface EachSegmentCallbackArg extends MeasureOptions {
  fn: () => unknown;
  benchmark: Benchmark;
  currentTestIndex: number;
  allTests: number;
  currentSuiteTestIndex: number;
  allSuiteTests: number;
  currentSegmentIndex: number;
  allSegments: number;
  isWarmup: boolean;
}

export type EachSegmentCallback = (arg: EachSegmentCallbackArg) => unknown; // if true is returned, the benchmark will stop

export interface BeforeAfterBenchmarkCallbackArg {
  benchmark: Benchmark;
  current: number; // Current benchmark index
  all: number; // Total number of benchmarks
  isWarmup: boolean; // Whether this is a warmup phase
}

export type BeforeAfterBenchmarkCallback = (arg: BeforeAfterBenchmarkCallbackArg) => unknown;

export interface Benchmark
  extends Partial<Omit<BenchmarkOptions, "beforeEachSegment" | "afterEachSegment" | "beforeEach" | "afterEach">> {
  name: string;
  tests: (() => unknown)[];

  beforeEachSegment?: EachSegmentCallback;
  afterEachSegment?: EachSegmentCallback;

  beforeBenchmark?: BeforeAfterBenchmarkCallback;
  afterBenchmark?: BeforeAfterBenchmarkCallback;
}

// results

export interface MeasureResult {
  hz: number; // Operations per second
  hzFormatted: string; // Formatted operations per second
  avg: number; // Average time per operation in milliseconds
  op: number; // Number of operations performed
  time: number; // Total time taken for the operations in milliseconds
  all?: number[]; // Array of all individual operation times in milliseconds
}

export interface TestResult extends MeasureResult {
  name: string;
  slowdownFactor?: number;
  error?: string;
  fastest?: boolean;
  slowest?: boolean;
  segments: MeasureResult[]; // results for each segment
}

export type AllResults = { name: string; tests: TestResult[] }[];

export let shouldStop = false; // flag to stop the benchmark

function resetStop(): null {
  shouldStop = false; // reset the stop flag
  return null;
}

export function stop() {
  shouldStop = true;
}

export function doNotOptimize<T>(value: T): T {
  $._ = value;
  return value;
}
interface Dollar {
  _: unknown;
  __(): void;
}
const globalSymbol = Symbol.for("benchmark_global_symbol");
export const $: Dollar = {
  _: null,
  __() {
    // @ts-expect-error no globalThis._ defined
    globalThis[globalSymbol] = $._;
    return console.log($._);
  },
};

function calcHz(time: number, op: number): number {
  return op / (time / 1000);
}

// ...existing code...

export function formatHz(hz: number): string {
  if (hz >= 1_000_000_000) {
    return `${(hz / 1_000_000_000).toFixed(2)}G`;
  } else if (hz >= 1_000_000) {
    return `${(hz / 1_000_000).toFixed(2)}M`;
  } else if (hz >= 1_000) {
    return `${(hz / 1_000).toFixed(2)}k`;
  } else {
    return `${hz.toFixed(2)}`;
  }
}

function measureSyncCumulativeByTime(
  fn: (random: number) => unknown,
  options: Partial<MeasureOptions> = {}
): MeasureResult | null {
  const { time, minOp } = { ...defaultValues(options.time, options.minOp), ...options };
  const checkAfterTimes = Math.round(minOp); // check every minSamples iterations to minimize performance impact
  let timesUntilCheck = checkAfterTimes;
  let op = 0;
  let totalTime = 0;
  let stop = false;
  if (shouldStop) {
    return resetStop();
  }
  const randomValues = new Array(checkAfterTimes).fill(0).map(() => Math.random());
  const start = performance.now();
  while (!stop) {
    fn(randomValues[timesUntilCheck - 1]);

    op++;

    // Check if we should stop.
    timesUntilCheck--;
    if (!timesUntilCheck) {
      timesUntilCheck = checkAfterTimes;
      totalTime = performance.now() - start;
      stop = totalTime > time && op >= minOp;
    }
  }
  // operations per second
  const hz = calcHz(totalTime, op);

  const hzFormatted = formatHz(hz);

  // average time per op in ms
  const avg = totalTime / op;

  return { hz, hzFormatted, avg, op, time: totalTime };
}

// a lot better because we don't need to check time which interacts with fn time
function measureSyncCumulativeByOp(fn: () => unknown, options: Partial<MeasureOptions> = {}): MeasureResult | null {
  const { minOp } = { ...defaultValues(options.time, options.minOp), ...options };
  let op = minOp;
  if (shouldStop) {
    return resetStop();
  }
  // const randomValues = new Array(minOp).fill(0).map(() => Math.random());
  const start = performance.now();
  while (op) {
    fn();
    op--;
  }
  const totalTime = performance.now() - start;

  //randomValues[0] = 0; // prevent gc

  // operations per second
  const hz = calcHz(totalTime, minOp);

  const hzFormatted = formatHz(hz);

  // average time per op in ms
  const avg = totalTime / minOp;

  return { hz, hzFormatted, avg, op, time: totalTime };
}

function measureSyncCumulative(fn: () => unknown, options: Partial<MeasureOptions> = {}): MeasureResult | null {
  if (options.time === 0) {
    return measureSyncCumulativeByOp(fn, options); // much better
  }
  return measureSyncCumulativeByTime(fn, options);
}

function measureSyncCumulativeSegmented(fn: () => unknown, options: Partial<SegmentedOptions> = {}) {
  if (shouldStop) {
    return resetStop();
  }
  const opts: SegmentedOptions = { ...defaultValues(options.time, options.minOp), ...options };
  // we need to recalculate times for segments
  if (opts.time) {
    opts.time = opts.time / opts.segmentsCount; // time for each segment
  }
  opts.minOp = Math.ceil(opts.minOp / opts.segmentsCount); // minOp for each segment

  const { segmentsCount, beforeEachSegment, afterEachSegment } = opts;
  const results: MeasureResult[] = [];

  for (let i = 0; i < segmentsCount; i++) {
    if (beforeEachSegment) {
      beforeEachSegment(i, segmentsCount);
    }
    const segmentOpts: MeasureOptions = { ...opts };
    const result = measureSyncCumulative(fn, segmentOpts);
    if (!result) {
      return null; // if result is null, we stop the benchmark
    }
    results.push(result);

    if (afterEachSegment) {
      afterEachSegment(i, segmentsCount);
    }
  }
  return results;
}

function _benchSync(
  benchmarks: Benchmark[],
  defaultOptions: Partial<BenchmarkOptions> = {},
  isWarmup: boolean = false
): AllResults | null {
  if (shouldStop) {
    return resetStop();
  }
  if (benchmarks.length === 0) {
    return [];
  }
  const defaultOpts: BenchmarkOptions = {
    ...defaultValues(defaultOptions.time, defaultOptions.minOp),
    ...defaultOptions,
  };
  const allSuiteTests = benchmarks.reduce((sum, benchmark) => sum + benchmark.tests.length, 0);
  let currentBenchmark: Benchmark = benchmarks[0];
  let currentTestFn: () => unknown = currentBenchmark.tests[0];
  let currentSuiteTestIndex = 0;

  // Run benchmark with progress updates
  const allResults: AllResults = [];
  currentSuiteTestIndex = 0; // reset after warmup

  for (let i = 0; i < benchmarks.length; i++) {
    if (shouldStop) {
      return resetStop();
    }
    try {
      currentBenchmark = benchmarks[i];

      if (currentBenchmark.beforeBenchmark) {
        currentBenchmark.beforeBenchmark({
          benchmark: currentBenchmark,
          current: i,
          all: benchmarks.length,
          isWarmup,
        });
      }

      const benchmarkResults: TestResult[] = [];
      for (let currentTestIndex = 0; currentTestIndex < currentBenchmark.tests.length; currentTestIndex++) {
        if (shouldStop) {
          return null; // if benchmarkStop is true, we stop the benchmark
        }
        currentTestFn = currentBenchmark.tests[currentTestIndex];
        const currentOptions: BenchmarkOptions = {
          ...defaultOpts,
          ...defaultValues(currentBenchmark.time ?? defaultOpts.time, currentBenchmark.minOp ?? defaultOpts.minOp),
        };
        // if is warmup, we must use time from options which is calculated already in method above
        // else take time from benchmark or use default time
        const time = isWarmup ? currentOptions.warmupTime : currentOptions.time;
        const minOp = isWarmup ? currentOptions.warmupMinOp : currentOptions.minOp;
        const segmentsCount = currentBenchmark.segmentsCount ?? currentOptions.segmentsCount;
        const segmentedOpts: SegmentedOptions = {
          ...currentOptions,
          time,
          minOp,
          segmentsCount,
          beforeEachSegment(currentSegmentIndex, allSegments) {
            if (currentBenchmark.beforeEachSegment) {
              currentBenchmark.beforeEachSegment({
                benchmark: currentBenchmark,
                fn: currentTestFn,
                currentTestIndex: currentTestIndex,
                allTests: currentBenchmark.tests.length,
                currentSuiteTestIndex: currentSuiteTestIndex,
                allSuiteTests: allSuiteTests,
                currentSegmentIndex,
                allSegments,
                isWarmup,
                time,
                minOp,
              });
            }
          },
          afterEachSegment(currentSegmentIndex, allSegments) {
            if (currentBenchmark.afterEachSegment) {
              currentBenchmark.afterEachSegment({
                benchmark: currentBenchmark,
                fn: currentTestFn,
                currentTestIndex,
                allTests: currentBenchmark.tests.length,
                currentSuiteTestIndex,
                allSuiteTests,
                currentSegmentIndex,
                allSegments,
                isWarmup,
                time,
                minOp,
              });
            }
          },
        };

        // choose the best strategy for measuring
        const segments = measureSyncCumulativeSegmented(currentTestFn, segmentedOpts);

        if (!segments) {
          return null; // if result is null, we stop the benchmark
        }

        const result: MeasureResult = segments.reduce(
          (acc, curr) => {
            acc.hz += curr.hz;
            acc.op += curr.op;
            acc.avg += curr.avg;
            acc.time += curr.time;
            return acc;
          },
          {
            hz: 0,
            op: 0,
            avg: 0,
            hzFormatted: "",
            time: 0,
          } as MeasureResult
        );
        result.hz = result.hz / segmentsCount;
        result.hzFormatted = formatHz(result.hz);
        result.avg = result.avg / segmentsCount;

        // Collect result
        benchmarkResults.push({
          ...result,
          name: currentTestFn.name,
          segments,
        });

        currentSuiteTestIndex++;
        if (shouldStop) {
          return null; // if benchmarkStop is true, we stop the benchmark
        }
      }

      allResults.push({ name: currentBenchmark.name, tests: benchmarkResults });

      if (currentBenchmark.afterBenchmark) {
        currentBenchmark.afterBenchmark({
          benchmark: currentBenchmark,
          current: i,
          all: benchmarks.length,
          isWarmup,
        });
      }
    } catch (error) {
      allResults.push({
        name: currentBenchmark?.name || "unknown",
        tests: [
          {
            name: `Benchmark: ${currentBenchmark?.name || "unknown"} test: ${currentTestFn?.name || "unknown"}`,
            hz: 0,
            hzFormatted: formatHz(0),
            time: 0,
            op: 0,
            avg: 0,
            segments: [],
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      });
      console.error("Benchmark error:", error);
    }
  }

  for (const results of allResults) {
    if (shouldStop) {
      return resetStop();
    }
    // Find fastest and slowest
    const validResults = results.tests.filter((r) => !r.error);
    if (validResults.length === 0) {
      // If no valid results, mark all as errors
      results.tests.forEach((r) => {
        r.error = results.tests[results.tests.length - 1].error || "Error";
        r.hz = 0;
        r.op = 0;
        r.avg = 0;
      });
      continue;
    }
    const sortedResults = [...validResults].sort((a, b) => b.hz - a.hz);
    sortedResults[0].fastest = true;
    sortedResults[sortedResults.length - 1].slowest = true;

    // Calculate slowdown factors relative to the fastest result
    const fastestHz = sortedResults[0].hz || 1;
    results.tests.forEach((result) => {
      if (!result.error && result.hz > 0) {
        result.slowdownFactor = fastestHz / result.hz;
      }
    });
  }

  return allResults;
}

export function benchSync(benchmarks: Benchmark[], defaultOptions: Partial<BenchmarkOptions> = {}): AllResults | null {
  if (shouldStop) {
    return resetStop();
  }
  const opts: BenchmarkOptions = { ...defaultValues(defaultOptions.time, defaultOptions.minOp), ...defaultOptions };
  // warmup
  const warmupResults = _benchSync(benchmarks, { ...opts }, true);
  if (!warmupResults) {
    return null; // if warmup returns null, we stop the benchmark
  }
  // run
  return _benchSync(benchmarks, opts);
}
