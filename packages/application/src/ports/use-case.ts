/**
 * A driving port. One file, one use case, one public method — that constraint
 * is what keeps route handlers thin and files small.
 */
export interface UseCase<In, Out> {
  execute(input: In): Promise<Out>
}
