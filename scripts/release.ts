import { $ } from "bun";
import packageJson from "../package.json" with { type: "json" };

type PackageJson = {
  name: string;
  version: string;
};

const pkg = packageJson as PackageJson;
const tag = `v${pkg.version}`;
const assetName = `${pkg.name}.tgz`;
const assetPath = `release/${assetName}`;

await $`bun run build`;
await $`mkdir -p release`;
await $`bun pm pack --filename ${assetPath} --ignore-scripts`;
await $`gh release create ${tag} ${assetPath} --title ${tag} --generate-notes --fail-on-no-commits`;

const repo = await $`gh repo view --json nameWithOwner --jq .nameWithOwner`.text();
const tarballUrl = `https://github.com/${repo.trim()}/releases/latest/download/${assetName}`;

console.log(`Release asset: ${tarballUrl}`);
console.log(`Install with: bun add ${tarballUrl}`);
