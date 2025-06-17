/**
 * Wraps function into infinite loop protection
 *
 * @Example
 *
 * function myFunction() {
 *     console.debug("Function is running.");
 *     myProtectedFunction(); // Simulate recursion
 * }
 *
 * const myProtectedFunction = infiniteLoopProtector(myFunction);
 *
 * myProtectedFunction();
 *
 * // Will print:
 * // > Function is running.
 * // > Infinite loop detected in function
 *
 * @param fn
 */
export function infiniteLoopProtector(fn: (...fnArgs: any[]) => any) {
  const activeCalls = new Set();

  return function protectedFunction(...args: any[]) {
    if (activeCalls.has(fn)) {
      console.warn(`Infinite loop detected in function "${fn.name}". Aborting call.`);
      return;
    }

    activeCalls.add(fn);
    try {
      // @ts-ignore
      return fn.apply(this, args); // Call the original function with the correct context and arguments
    } finally {
      activeCalls.delete(fn); // Ensure cleanup after execution
    }
  };
}

/**
 * Resolves an array of promises sequentially, collecting their resolved values in an array.
 * If any promise fails, the entire process will fail, and no further promises will be resolved.
 *
 * @param {Array<Promise>} promises - An array of promises to resolve.
 * @returns {Promise<Array>} A promise that resolves to an array of resolved values from the promises.
 *
 * @example
 * const promises = [
 *   Promise.resolve('Result 1'),
 *   Promise.resolve('Result 2'),
 *   Promise.reject('Error 3'),
 * ];
 *
 * resolvePromisesSequentially(promises)
 *   .then(results => console.log(results))
 *   .catch(error => console.error(error.message));  // Output: "One of the promises failed"
 */
export async function resolvePromisesSequentially(promises: Promise<any>[]) {
  const results = [];

  for (const promise of promises) {
    try {
      const result = await promise;
      results.push(result);
    } catch (error) {
      return results;
    }
  }

  return results;
}
