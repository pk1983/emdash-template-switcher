import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export async function runUpgrade({ cwd, packageManager }) {
	const pm = packageManager || detectPackageManager(cwd);
	const command = installCommand(pm);
	if (!command) {
		throw new Error(`Unsupported package manager: ${pm}`);
	}

	console.log(`\nUpdating emdash-template-switcher with ${pm}...`);
	execFileSync(command.cmd, command.args, { cwd, stdio: "inherit" });
	console.log("\n✓ emdash-template-switcher updated");
}

function detectPackageManager(cwd) {
	const ua = process.env.npm_config_user_agent || "";
	if (ua.startsWith("pnpm/")) return "pnpm";
	if (ua.startsWith("yarn/")) return "yarn";
	if (ua.startsWith("bun/")) return "bun";

	if (existsSync(`${cwd}/pnpm-lock.yaml`)) return "pnpm";
	if (existsSync(`${cwd}/yarn.lock`)) return "yarn";
	if (existsSync(`${cwd}/bun.lockb`)) return "bun";
	return "npm";
}

function installCommand(pm) {
	switch (pm) {
		case "npm":
			return { cmd: "npm", args: ["install", "-D", "emdash-template-switcher@latest"] };
		case "pnpm":
			return { cmd: "pnpm", args: ["add", "-D", "emdash-template-switcher@latest"] };
		case "yarn":
			return { cmd: "yarn", args: ["add", "-D", "emdash-template-switcher@latest"] };
		case "bun":
			return { cmd: "bun", args: ["add", "-d", "emdash-template-switcher@latest"] };
		default:
			return null;
	}
}
