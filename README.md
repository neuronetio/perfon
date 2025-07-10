# perfon

Javascript performance benchmarking library for browsers especially (also works very well with nodejs).

```ts
import { benchSync } from "perfon";


const size = 1000;

function push() {
  const arr: number[] = [];
  for (let i = 0; i < size; i++) {
    arr.push(i);
  }
  return arr;
}

function direct(){
  const arr: number[] = new Array(size);
  for (let i = 0; i < size; i++) {
    arr[i] = i;
  }
  return arr;
}

export const benchmarks: Benchmark[] = [
  {
    name: "Array Push vs Direct Assignment",
    tests: [push, direct],

    // benchmark options
    // time: 3000, // 3 seconds per test
    // minOp: 100, // Minimum 100 operations per test
    // segmentsCount: 50, // Run each test in 50 segments

    // beforeBenchmark(data) {
    //   console.log('before benchmark', data);
    // },
    // afterBenchmark(data) {
    //   console.log('after benchmark', data);
    // },
    // beforeEachSegment(data) {
    //   console.log('before segment', data);
    // },
    // afterEachSegment(data) {
    //   console.log('after segment', data);
    // },
  }
];

// Default benchmark options for all tests - used when not provided in the benchmark
//
// const defaultBenchmarkOptions: BenchmarkOptions = {
//     time: 3000, // 3 seconds per test
//     minOp: 100, // Minimum 100 operations per test
//     segmentsCount: 50, // Run each test in 50 segments

//     beforeBenchmark(data) {
//       console.log('before benchmark', data);
//     },
//     afterBenchmark(data) {
//       console.log('after benchmark', data);
//     },
//     beforeEachSegment(data) {
//       console.log('before segment', data);
//     },
//     afterEachSegment(data) {
//       console.log('after segment', data);
//     },
// }

const results = benchSync(benchmarks /* , defaultBenchmarkOptions */);
```
