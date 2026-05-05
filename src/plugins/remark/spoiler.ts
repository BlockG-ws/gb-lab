import { visit } from 'unist-util-visit';

export default function remarkSpoiler(options: any = {}) {
    const nodeType = options.nodeType ?? 'spoiler';
    const marker = options.marker ?? '||';
    const classNames = options.classNames ?? ["spoiler"];
    const tagType = options.tagType ?? 'span';

    return (tree: any) => {
        visit(tree, 'text', (node: any, index: any, parent: any) => {
            if (!node.value || typeof node.value !== 'string') return;

            const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`${escapedMarker}(.*?)${escapedMarker}`, 'g');

            if (!regex.test(node.value)) return;

            const children = [];
            let lastIndex = 0;
            regex.lastIndex = 0;
            let match;

            while ((match = regex.exec(node.value)) !== null) {
                if (match.index > lastIndex) {
                    children.push({
                        type: 'text',
                        value: node.value.slice(lastIndex, match.index),
                    });
                }

                children.push({
                    type: nodeType,
                    data: {
                        hName: tagType,
                        hProperties: classNames.length ? { className: classNames } : {},
                    },
                    children: [{ type: 'text', value: match[1] }],
                });

                lastIndex = regex.lastIndex;
            }

            if (lastIndex < node.value.length) {
                children.push({
                    type: 'text',
                    value: node.value.slice(lastIndex),
                });
            }

            if (parent && typeof index === 'number') {
                parent.children.splice(index, 1, ...children);
                return index + children.length;
            }
        });
    };
}
