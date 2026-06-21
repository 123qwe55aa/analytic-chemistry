#!/usr/bin/env python3
"""Extract questions from 查看详情 HTML files (Chaoxing exam view format)."""
import re, json, os, html

HOMEWORK_DIR = "/Users/toby/Documents/Projects/03_research-labs/analytic chemistry/site/homework"

def extract_view_details(filepath, label):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
    
    questions = []
    
    # Find all TiMu divs - each is a question block
    timu_blocks = re.findall(r'<div[^>]*class="[^"]*TiMu[^"]*"[^>]*id="[^"]*"[^>]*>(.*?)</div>\s*(?=<div[^>]*class="[^"]*TiMu|$)', content, re.DOTALL)
    
    for block in timu_blocks:
        # Question type
        qtype_match = re.search(r'<span class="colorShallow">\((\w+)', block)
        if not qtype_match:
            continue
        qtype = qtype_match.group(1)
        
        # Question text - in qtContent
        qt_match = re.search(r'<span class="qtContent">(.*?)</span>', block, re.DOTALL)
        if not qt_match:
            continue
        question_text = strip_html(qt_match.group(1)).strip()
        if not question_text:
            continue
        
        # Options - in ul or li
        options = []
        # Try standard li pattern
        li_matches = re.findall(r'<li[^>]*>(.*?)</li>', block, re.DOTALL)
        for li in li_matches:
            # Skip li that's just the question
            if '答案' in li or '解析' in li or '正确答案' in li:
                continue
            opt_text = strip_html(li).strip()
            if opt_text and len(opt_text) > 1 and not opt_text.startswith('我的答案'):
                options.append(opt_text)
        
        if qtype == '判断题' and not options:
            options = ['正确', '错误']
        
        # Correct answer
        answer = ""
        ans_match = re.search(r'正确答案[：:]\s*<span[^>]*>(.*?)</span>', block)
        if ans_match:
            answer = strip_html(ans_match.group(1)).strip()
        
        # For TiMu format, answers might also be in other patterns
        if not answer:
            ans_match = re.search(r'rightAnswer"[^>]*>.*?<span[^>]*>(.*?)</span>', block, re.DOTALL)
            if ans_match:
                answer = strip_html(ans_match.group(1)).strip()
        
        if qtype == '判断题':
            if answer in ('对', '正确', 'T', 'true', 'True', '√'):
                answer = '正确'
            elif answer in ('错', '错误', 'F', 'false', 'False', '×'):
                answer = '错误'
        
        questions.append({
            'id': f'{label}-{len(questions)+1}',
            'source': label,
            'type': qtype,
            'question': question_text,
            'options': options,
            'answer': answer
        })
    
    return questions

def strip_html(text):
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def main():
    all_questions = []
    
    for fname, label in [('查看详情.html', 'view1'), ('查看详情1.html', 'view2'), ('查看详情2.html', 'view3')]:
        fpath = os.path.join(HOMEWORK_DIR, fname)
        if os.path.exists(fpath):
            qs = extract_view_details(fpath, label)
            print(f"  {fname}: {len(qs)} questions")
            all_questions.extend(qs)
    
    print(f"\nTotal from 查看详情: {len(all_questions)}")
    from collections import Counter
    tc = Counter(q['type'] for q in all_questions)
    for t, c in tc.most_common():
        print(f"  {t}: {c}")
    
    # Output for inspection
    with open('/tmp/view_questions.json', 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
    print("\nSample questions:")
    for q in all_questions[:3]:
        print(f"  [{q['type']}] {q['question'][:60]}...")
        if q['options']:
            print(f"    Options: {len(q['options'])}")
        print(f"    Answer: {q['answer']}")

if __name__ == '__main__':
    main()
