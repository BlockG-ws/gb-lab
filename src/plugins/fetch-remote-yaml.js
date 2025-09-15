import yaml from "js-yaml";

export default function remoteYAML(url) {
    // rewritten from the file loader to fetch remote YAML data
    return {
        name: 'remote-yaml-loader',
        async load(context) {
            const { logger, parseData, store } = context;

            logger.debug(`Fetching remote YAML from ${url}`);

            let data;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.error(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
                }
                const contents = await response.text();
                data = yaml.load(contents, { filename: url });
            } catch (error) {
                logger.error(`Error fetching or parsing data from ${url}`);
                logger.debug(error.message);
                return;
            }

            const filePath = url;

            if (Array.isArray(data)) {
                if (data.length === 0) {
                    logger.warn(`No items found in ${filePath}`);
                }
                logger.debug(`Found ${data.length} item array in ${filePath}`);
                store.clear();
                const idList = new Set();
                for (const rawItem of data) {
                    const id = (rawItem.id ?? rawItem.slug)?.toString();
                    if (!id) {
                        logger.error(`Item in ${filePath} is missing an 'id' or 'slug' field.`);
                        continue;
                    }
                    if (idList.has(id)) {
                        logger.warn(`Duplicate id "${id}" found in ${filePath}. Later items will overwrite earlier ones.`);
                    }
                    idList.add(id);
                    const parsedData = await parseData({ id, data: rawItem, filePath });
                    store.set({ id, data: parsedData, filePath });
                }
            } else if (data && typeof data === 'object') {
                const entries = Object.entries(data);
                logger.debug(`Found object with ${entries.length} entries in ${filePath}`);
                store.clear();
                for (const [id, rawItem] of entries) {
                    if (id === '$schema' && typeof rawItem === 'string') {
                        continue;
                    }
                    const parsedData = await parseData({ id, data: rawItem, filePath });
                    store.set({ id, data: parsedData, filePath });
                }
            } else {
                logger.error(`Invalid data in ${filePath}. Expected an array or object.`);
            }
        }
    };
}
