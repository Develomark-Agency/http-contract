import { $ } from "bun";
import pkg from "../package.json";

const commit = (await $`git rev-parse --short HEAD`.text()).trim();
const tag = `v${pkg.version}-${commit}`;
const assetName = `${pkg.name}.tgz`;
const assetPath = `release/${assetName}`;

await $`bun run build`;
await $`mkdir -p release`;
await $`bun pm pack --filename ${assetPath} --ignore-scripts`;
await $`gh release create ${tag} ${assetPath} --title ${tag} --generate-notes --fail-on-no-commits`;

const repo = await $`gh repo view --json nameWithOwner --jq .nameWithOwner`.text();
const tarballUrl = `https://github.com/${repo.trim()}/releases/download/${tag}/${assetName}`;

console.log(`Release asset: ${tarballUrl}`);
console.log(`Install with: bun add ${tarballUrl}`);
