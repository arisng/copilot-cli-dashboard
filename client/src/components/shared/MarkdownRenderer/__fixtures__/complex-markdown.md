# Complex Markdown Test Fixtures

This file contains complex markdown patterns used for regression testing the markdown renderer.

## 1. Mixed Markdown + XML-like Content

<history>

1. **User invoked `skill-creator` skill**
   - Read existing files and references
   - Identified issues and applied edits

2. **User requested fleet-mode batch work**
   - Dispatched parallel subagents
   - Collected status updates

</history>

<analysis>

### Key Findings

- First item with **bold text** and `inline code`
- Second item with [a link](https://example.com)
- Third item with nested structure
  - Sub-item A
  - Sub-item B

</analysis>

## 2. Nested Lists with Ordered and Unordered

### 2.1 Ordered List with Unordered Sub-items

1. First ordered item
   - Unordered sub-item 1.1
   - Unordered sub-item 1.2
     - Nested deeper 1.2.1
     - Nested deeper 1.2.2
   - Unordered sub-item 1.3

2. Second ordered item with `code` and **bold**
   - Sub-item with [link](https://example.com)
   - Sub-item with *italic* text

3. Third ordered item
   - Mixed content: **bold**, `code`, and *italic*
   - Another sub-item

### 2.2 Unordered List with Ordered Sub-items

- Main bullet 1
  1. Ordered sub-item 1.1
  2. Ordered sub-item 1.2
     - Deep unordered
     - Another deep unordered
  3. Ordered sub-item 1.3

- Main bullet 2
  1. First sub
  2. Second sub

- Main bullet 3 with **bold** content

### 2.3 Deep Nesting (5 levels)

1. Level 1
   - Level 2
     1. Level 3
        - Level 4
          - Level 5 with text

## 3. Task Lists

### 3.1 Simple Task List

- [x] Completed task
- [ ] Unchecked task
- [x] Another completed task
- [ ] Pending task with **bold** text

### 3.2 Task List with Nesting

- [x] Parent task completed
  - [x] Child task 1
  - [x] Child task 2
  - [ ] Child task 3 pending
- [ ] Parent task pending
  - [ ] Child task 4
  - [x] Child task 5 (completed early)

## 4. Tables

### 4.1 Simple Table

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

### 4.2 Table with Inline Formatting

| Feature | Status | Notes |
|---------|--------|-------|
| **Bold** | `code` | *Italic* note |
| [Link](https://example.com) | ✅ | Working |
| Mixed `code` and **bold** | Status | Regular text |

### 4.3 Wide Table (for scroll testing)

| Column A | Column B | Column C | Column D | Column E | Column F | Column G |
|----------|----------|----------|----------|----------|----------|----------|
| Data 1   | Data 2   | Data 3   | Data 4   | Data 5   | Data 6   | Data 7   |
| Long text that might wrap or require scrolling in narrow viewports | More data | Even more data here | And here | Also here | Finally here | Last column |

## 5. Code Blocks

### 5.1 Inline Code

Here is some `inline code` and then more text. Multiple `inline` `code` `segments` in one line.

### 5.2 Fenced Code Block

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): User {
  return {
    id,
    name: 'Test User',
    email: 'test@example.com'
  };
}
```

### 5.3 Code Block with Syntax Highlighting

```javascript
// Example with various tokens
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);

async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}
```

### 5.4 Long Lines in Code Blocks

```bash
# This is a very long command that might need horizontal scrolling on mobile or narrow viewports
curl -X POST https://api.example.com/v1/resources/subresources/nested-resources/actions/execute -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" -d '{"key":"value","anotherKey":"anotherValue"}'
```

## 6. Blockquotes

### 6.1 Simple Blockquote

> This is a simple blockquote.
> It spans multiple lines.

### 6.2 Blockquote with Formatting

> **Bold text** in a blockquote
> `Code` inside the quote
> *Italic text* as well

### 6.3 Nested Blockquotes

> Outer level quote
>> Inner level quote
>> With multiple lines
> Back to outer level
>> Another inner level
>>> Third level nesting

### 6.4 Blockquote with List

> Quote introduction:
> - Item 1 in quote
> - Item 2 in quote
>   - Nested item
> - Item 3 in quote
>
> Quote continuation after list

## 7. Headings

# H1 Heading

## H2 Heading

### H3 Heading

#### H4 Heading

##### H5 Heading

###### H6 Heading

## 8. Horizontal Rules

Above the rule.

---

Below the rule.

## 9. Combined Complex Example

### Session Analysis Report

<history>

1. **Initialization Phase**
   - [x] Load configuration from `config.yaml`
   - [x] Initialize database connection
   - [ ] Run migration scripts (pending)

2. **Processing Phase**
   - Processed 1,234 records
   - Generated the following summary:

   | Metric | Value | Status |
   |--------|-------|--------|
   | Total | 1,234 | ✅ |
   | Success | 1,200 | ✅ |
   | Failed | 34 | ⚠️ |

   ```python
   def process_records(records):
       results = []
       for record in records:
           try:
               result = transform(record)
               results.append(result)
           except Exception as e:
               logger.error(f"Failed: {e}")
       return results
   ```

3. **Cleanup Phase**
   - Closed connections
   - Released resources
   > Note: Some resources may need manual cleanup

</history>

## 10. Edge Cases

### 10.1 Empty Elements

Empty line below:


Empty line above

### 10.2 Special Characters

HTML entities: &lt; &gt; &amp; &quot;

Emoji: 🎉 🚀 ✅ ❌

### 10.3 Mixed Content Lines

Text with **bold** and `code` and [link](https://example.com) and *italic* all together.

### 10.4 XML-like Tags in Text

The `<history>` tag is used to wrap historical data. You can also use `<analysis>` or `<report>` tags.

This should not break: `<unclosed` or `incomplete>`
