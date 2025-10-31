import {execSync} from "child_process";
import {statSync} from "node:fs";

export function remarkModifiedTime() {
    return function (tree, file) {
        const filepath = file.history[0];
        try {
            file.data.astro.frontmatter.lastModified = execSync(`git log -1 --pretty="format:%cI" "${filepath}"`).toString();
        } catch {
            console.log("fetch time from git log failed, falling back to date");
            file.data.astro.frontmatter.lastModified = statSync(filepath).mtime.toISOString();
        }
    };
}