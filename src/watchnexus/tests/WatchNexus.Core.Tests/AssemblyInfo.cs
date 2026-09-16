using Xunit;

// The ModuleRegistry is a process-wide static that both ModuleLoaderTests
// (ClearForTesting) and the integration tests (PopulateTestModuleRegistry)
// mutate. xUnit parallelizes across test collections by default, which
// causes cross-class races and intermittent failures. Run collections
// serially instead.
[assembly: CollectionBehavior(DisableTestParallelization = true)]