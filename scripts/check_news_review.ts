import { GeminiAnalyzer } from "../src/analyzer/geminiAnalyzer";
import { NewsBodyReader } from "../src/news/newsBodyReader";
import { REDEVELOPMENT_SEED_PROJECTS } from "../src/registry/redevelopmentRegistry";
async function main() {
  const entries = JSON.parse(process.argv[1]);
  let cursor = 0;
  const out: any[] = [];
  await Promise.all(
    [0, 1].map(async () => {
      while (cursor < entries.length) {
        const { entry, body } = entries[cursor++];
        const analyzer = new GeminiAnalyzer();
        analyzer.beginRun();
        const item = await new NewsBodyReader({
          get: async () => body,
          set: async () => {},
        }).enrich(entry.item);
        const project = REDEVELOPMENT_SEED_PROJECTS.find(
          (p) => p.id === item.projectId,
        )!;
        const validation = await analyzer.validateRelatedness(item, project);
        let payload;
        try {
          if (validation.status === "relevant")
            payload = await analyzer.extractEvent(item, project);
        } catch (e: any) {
          payload = { error: e.message };
        }
        const result = {
          id: entry.id,
          title: item.title,
          validation,
          payload,
          usage: analyzer.usage,
        };
        out.push(result);
        console.log("[NEWS_REVIEW_ITEM] " + JSON.stringify(result));
      }
    }),
  );
  console.log("[NEWS_REVIEW_RESULTS] " + JSON.stringify(out));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
