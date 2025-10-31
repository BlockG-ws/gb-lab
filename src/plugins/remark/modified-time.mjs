import {execSync} from "child_process";
import {statSync} from "node:fs";

export function remarkModifiedTime() {
    return function (tree, file) {
        const filepath = file.history[0];
        let modifiedTime;
        try {
            modifiedTime = execSync(`git log -1 --pretty="format:%cI" "${filepath}"`,{ encoding: 'utf8' }).toString().trim();
        } catch(error) {
            console.log("fetch time from git log failed, falling back to file modification date");
            modifiedTime = statSync(filepath).mtime.toISOString();
        }
        file.data.astro.frontmatter.lastModified = modifiedTime;
    };
}