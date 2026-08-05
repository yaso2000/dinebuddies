/** @typedef {import('eslint').Rule.RuleModule} RuleModule */

const RAW_TEXT_TAGS = new Set(['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'password']);

/**
 * @param {import('estree-jsx').JSXOpeningElement['name']} nameNode
 * @returns {string | null}
 */
function getTagName(nameNode) {
    if (!nameNode) return null;
    if (nameNode.type === 'JSXIdentifier') return nameNode.name;
    if (nameNode.type === 'JSXMemberExpression' && nameNode.property?.type === 'JSXIdentifier') {
        return nameNode.property.name;
    }
    return null;
}

/**
 * @param {import('estree-jsx').JSXAttribute[]} attributes
 * @returns {string | null}
 */
function getInputType(attributes) {
    const typeAttr = attributes.find(
        (attr) => attr.type === 'JSXAttribute' && attr.name?.name === 'type'
    );
    if (!typeAttr) return 'text';
    if (typeAttr.value == null) return 'text';
    if (typeAttr.value.type === 'Literal' && typeof typeAttr.value.value === 'string') {
        return typeAttr.value.value;
    }
    // type={expr} — cannot infer; still nudge toward AppTextInput
    return null;
}

/** @type {RuleModule} */
const noRawTextElements = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Require AppText instead of raw p/span/h1–h6 for BiDi-safe copy',
        },
        schema: [],
        messages: {
            useAppText:
                'Use <AppText as="{{tag}}"> instead of <{{tag}}> for BiDi-safe text (see src/components/base/AppText.jsx).',
        },
    },
    create(context) {
        return {
            JSXOpeningElement(node) {
                const tag = getTagName(node.name);
                if (!tag || !RAW_TEXT_TAGS.has(tag)) return;
                context.report({
                    node,
                    messageId: 'useAppText',
                    data: { tag },
                });
            },
        };
    },
};

/** @type {RuleModule} */
const noRawTextInput = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Require AppTextInput instead of raw text inputs for BiDi-safe typing',
        },
        schema: [],
        messages: {
            useAppTextInput:
                'Use <AppTextInput> instead of <{{tag}}> for BiDi-safe user input (see src/components/base/AppTextInput.jsx).',
            useAppTextInputTextarea:
                'Use <AppTextInput as="textarea"> instead of <textarea> for BiDi-safe user input.',
        },
    },
    create(context) {
        return {
            JSXOpeningElement(node) {
                const tag = getTagName(node.name);
                if (tag === 'textarea') {
                    context.report({ node, messageId: 'useAppTextInputTextarea' });
                    return;
                }
                if (tag !== 'input') return;

                const inputType = getInputType(node.attributes);
                if (inputType === null || TEXT_INPUT_TYPES.has(inputType)) {
                    context.report({
                        node,
                        messageId: 'useAppTextInput',
                        data: { tag: inputType ? `input type="${inputType}"` : 'input' },
                    });
                }
            },
        };
    },
};

module.exports = {
    rules: {
        'no-raw-text-elements': noRawTextElements,
        'no-raw-text-input': noRawTextInput,
    },
};
