import { describe, it, expect } from 'vitest';
import { normalizeXmlTags } from './MarkdownRenderer';

describe('normalizeXmlTags', () => {
  describe('known structural tags', () => {
    it('converts <overview> to h2 heading', () => {
      const input = '<overview>Session overview content</overview>';
      const result = normalizeXmlTags(input);
      expect(result).toBe('## Overview\n\nSession overview content');
    });

    it('converts <history> to h2 heading', () => {
      const input = '<history>1. First step\n2. Second step</history>';
      const result = normalizeXmlTags(input);
      expect(result).toBe('## History\n\n1. First step\n2. Second step');
    });

    it('converts <work_done> to h2 heading', () => {
      const input = '<work_done>Files modified</work_done>';
      const result = normalizeXmlTags(input);
      expect(result).toBe('## Work Done\n\nFiles modified');
    });

    it('converts <technical_details> to h2 heading with title case', () => {
      const input = '<technical_details>API specifications</technical_details>';
      const result = normalizeXmlTags(input);
      expect(result).toBe('## Technical Details\n\nAPI specifications');
    });

    it('unwraps <section> tags without adding heading', () => {
      const input = '<section>Section content here</section>';
      const result = normalizeXmlTags(input);
      expect(result).toBe('Section content here');
    });
  });

  describe('multiline content', () => {
    it('handles multiline content within tags', () => {
      const input = `<history>
1. **Step one**
   - Nested bullet
   - Another bullet

2. **Step two**
   More content here
</history>`;
      const result = normalizeXmlTags(input);
      expect(result).toBe(`## History

1. **Step one**
   - Nested bullet
   - Another bullet

2. **Step two**
   More content here`);
    });

    it('handles tags with blank lines', () => {
      const input = `<overview>

Content with blank lines

More content

</overview>`;
      const result = normalizeXmlTags(input);
      expect(result).toBe(`## Overview

Content with blank lines

More content`);
    });
  });

  describe('unknown tags', () => {
    it('preserves unknown XML tags as-is', () => {
      const input = '<customtag>Custom content</customtag>';
      const result = normalizeXmlTags(input);
      expect(result).toBe('<customtag>Custom content</customtag>');
    });

    it('preserves XML-like tags in inline text', () => {
      const input = 'The <history> tag is used for session history.';
      const result = normalizeXmlTags(input);
      expect(result).toBe('The <history> tag is used for session history.');
    });

    it('handles incomplete tags gracefully', () => {
      const input = 'Unclosed <tag or incomplete>';
      const result = normalizeXmlTags(input);
      expect(result).toBe('Unclosed <tag or incomplete>');
    });
  });

  describe('multiple tags', () => {
    it('converts multiple known tags in same content', () => {
      const input = `<overview>Overview content</overview>

<history>History content</history>`;
      const result = normalizeXmlTags(input);
      expect(result).toBe(`## Overview

Overview content

## History

History content`);
    });

    it('handles mixed known and unknown tags', () => {
      const input = `<overview>Overview</overview>
<unknown>Keep this</unknown>
<history>History</history>`;
      const result = normalizeXmlTags(input);
      expect(result).toBe(`## Overview

Overview
<unknown>Keep this</unknown>
## History

History`);
    });
  });

  describe('nested content preservation', () => {
    it('preserves nested markdown within converted tags', () => {
      const input = `<history>
1. **Bold item**
   - Sub-item with *italic*
   - [Link](https://example.com)

2. \`inline code\`
</history>`;
      const result = normalizeXmlTags(input);
      expect(result).toContain('## History');
      expect(result).toContain('**Bold item**');
      expect(result).toContain('*italic*');
      expect(result).toContain('[Link](https://example.com)');
      expect(result).toContain('`inline code`');
    });

    it('preserves code blocks within converted tags', () => {
      const input = `<technical_details>
Example code:

\`\`\`typescript
const x = 1;
\`\`\`
</technical_details>`;
      const result = normalizeXmlTags(input);
      expect(result).toContain('## Technical Details');
      expect(result).toContain('```typescript');
      expect(result).toContain('const x = 1;');
    });
  });

  describe('edge cases', () => {
    it('handles empty tags', () => {
      const input = '<overview></overview>';
      const result = normalizeXmlTags(input);
      expect(result).toBe('## Overview\n\n');
    });

    it('handles self-closing style (not actual self-closing)', () => {
      const input = '<section></section>';
      const result = normalizeXmlTags(input);
      expect(result).toBe('');
    });

    it('preserves content without any XML tags', () => {
      const input = 'Plain markdown content\n\n- Item 1\n- Item 2';
      const result = normalizeXmlTags(input);
      expect(result).toBe(input);
    });

    it('handles tags with attributes (treats as unknown)', () => {
      const input = '<overview class="test">Content</overview>';
      const result = normalizeXmlTags(input);
      // Tags with attributes don't match the simple pattern, so they're preserved
      expect(result).toBe('<overview class="test">Content</overview>');
    });
  });
});
