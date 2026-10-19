import { execFileSync } from "node:child_process";

// Uses the normal Git credential helper. Credentials stay in memory and are never printed or written.
const [mode = "status", repoName = "subtitle-checker"] = process.argv.slice(2);
if (!/^[A-Za-z0-9._-]+$/.test(repoName))
  throw new Error("Invalid repository name");
const raw = execFileSync("git", ["credential", "fill"], {
  input: "protocol=https\nhost=github.com\n\n",
  encoding: "utf8",
  env: { ...process.env, GCM_INTERACTIVE: "Never" },
});
const credential = Object.fromEntries(
  raw
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const headers = {
  Authorization: `Bearer ${credential.password}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
async function api(path, method = "GET", body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${data.message}`);
  return data;
}
const profile = await api("/user");
const repository = `${profile.login}/${repoName}`;
if (mode === "create") {
  const result = await api("/user/repos", "POST", {
    name: repoName,
    description: "浏览器本地运行的字幕检查与本土化校对工作台",
    private: false,
    auto_init: false,
  });
  console.log(
    JSON.stringify({
      repository: result.full_name,
      url: result.html_url,
      cloneUrl: result.clone_url,
    }),
  );
} else if (mode === "enable") {
  const result = await api(`/repos/${repository}/pages`, "POST", {
    build_type: "workflow",
  });
  console.log(
    JSON.stringify({
      repository,
      url: result.html_url,
      build_type: result.build_type,
    }),
  );
} else if (mode === "status") {
  const pages = await api(`/repos/${repository}/pages`);
  const runs = await api(`/repos/${repository}/actions/runs?per_page=3`);
  console.log(
    JSON.stringify(
      {
        repository,
        url: pages.html_url,
        status: pages.status,
        runs: runs.workflow_runs.map((run) => ({
          id: run.id,
          sha: run.head_sha,
          status: run.status,
          conclusion: run.conclusion,
          url: run.html_url,
        })),
      },
      null,
      2,
    ),
  );
} else throw new Error("Use create, enable, or status");
