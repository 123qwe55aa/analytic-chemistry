#!/usr/bin/env python3
"""Extract questions from 查看详情.html files (different format from 作业详情)."""
import re, json, os, html

HOMEWORK_DIR = "/Users/toby/Documents/Projects/03_research-labs/analytic chemistry/site/homework"
OUTPUT = "/Users/toby/Documents/Projects/03_research-labs/analytic chemistry/site/data/view-questions.json"

def extract_questions(filepath, label):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove scripts and styles
    content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
    
    questions = []
    
    # Split by questionLi divs
    blocks = re.findall(r'<div[^>]*class="[^"]*marBom60\s+questionLi[^"]*"[^>]*id="question(\d+)"[^>]*>(.*?)</div>\s*(?=<div[^>]*class="[^"]*marBom60\s+questionLi|$)', content, re.DOTALL)
    
    for qid, block in blocks:
        # Type: "(单选题, 5.0 分)" or "(单选题)"
        qtype = ""
        qt_match = re.search(r'<span class="colorShallow">\((\w+)', block)
        if qt_match:
            qtype = qt_match.group(1)
        
        # Question text in qtContent (without workTextWrap class)
        qt_text_match = re.search(r'<span class="qtContent">(.*?)</span>', block, re.DOTALL)
        if not qt_text_match:
            qt_text_match = re.search(r'<span class="qtContent workTextWrap">(.*?)</span>', block, re.DOTALL)
        if not qt_text_match:
            continue
        question_text = strip_html(qt_text_match.group(1)).strip()
        if not question_text or len(question_text) < 5:
            continue
        
        # Options - li inside ul.mark_letter
        options = []
        # Find the ul.mark_letter block
        ul_match = re.search(r'<ul[^>]*class="[^"]*mark_letter[^"]*"[^>]*>(.*?)</ul>', block, re.DOTALL)
        if ul_match:
            ul_content = ul_match.group(1)
            li_matches = re.findall(r'<li[^>]*>(.*?)</li>', ul_content, re.DOTALL)
            for li in li_matches:
                opt_text = strip_html(li).strip()
                # Remove leading "A. " / "B. " etc for cleaner display
                # But keep it since it's part of the exam format
                if opt_text and len(opt_text) > 1:
                    options.append(opt_text)
        
        if qtype == '判断题' and not options:
            options = ['正确', '错误']
        
        # Correct answer
        answer = ""
        ans_candidates = re.findall(r'<span class="rightAnswerContent[^"]*"[^>]*>(.*?)</span>', block, re.DOTALL)
        for a in ans_candidates:
            a = strip_html(a).strip()
            if a:
                answer = a
                break
        
        if qtype == '判断题':
            if answer in ('对', '正确', 'T', 'true', 'True', '√'):
                answer = '正确'
            elif answer in ('错', '错误', 'F', 'false', 'False', '×'):
                answer = '错误'
        
        if question_text:
            questions.append({
                'id': f'view-{label}-{qid}',
                'source': label,
                'type': qtype,
                'question': question_text,
                'options': options,
                'answer': answer
            })
    
    return questions


def strip_html(text):
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def convert_to_quiz(questions, start_id):
    """Convert to quiz.json format."""
    quiz_qs = []
    for i, q in enumerate(questions):
        qtype = q['type']
        
        if qtype in ('单选题', '多选题'):
            options = []
            ans = q['answer'].strip().upper()
            # For multi-select, get all correct letters
            correct_set = set()
            ans_clean = re.sub(r'[,;，；\s]+', '', ans)
            for ch in ans_clean:
                correct_set.add(ch)
            
            for j, opt in enumerate(q['options']):
                options.append({
                    'text': opt,
                    'isCorrect': chr(65 + j) in correct_set if options else False,
                    'rationale': ''
                })
            
            quiz_qs.append({
                'id': f'hw{start_id + i + 1:03d}',
                'chapter': 'homework',
                'topic': q.get('source', 'homework'),
                'difficulty': 2 if qtype == '单选题' else 3,
                'question': q['question'],
                'answerOptions': options,
                'hint': ''
            })
        
        elif qtype == '判断题':
            is_true = q['answer'] == '正确'
            options = [
                {'text': '正确', 'isCorrect': is_true, 'rationale': ''},
                {'text': '错误', 'isCorrect': not is_true, 'rationale': ''}
            ]
            quiz_qs.append({
                'id': f'hw{start_id + i + 1:03d}',
                'chapter': 'homework',
                'topic': q.get('source', 'homework'),
                'difficulty': 2,
                'question': q['question'],
                'answerOptions': options,
                'hint': ''
            })
        
        elif qtype in ('填空题', '简答题', '问答题'):
            continue  # Skip non-MC
        
    return quiz_qs


def main():
    all_questions = []
    
    for fname, label in [('查看详情.html', 'view1'), ('查看详情1.html', 'view2'), ('查看详情2.html', 'view3')]:
        fpath = os.path.join(HOMEWORK_DIR, fname)
        if os.path.exists(fpath):
            qs = extract_questions(fpath, label)
            print(f"  {fname}: {len(qs)} questions")
            all_questions.extend(qs)
    
    print(f"\nTotal from 查看详情: {len(all_questions)}")
    from collections import Counter
    tc = Counter(q['type'] for q in all_questions)
    for t, c in tc.most_common():
        print(f"  {t}: {c}")
    
    # Sample
    if all_questions:
        print(f"\nSample:")
        for q in all_questions[:3]:
            print(f"  [{q['type']}] {q['question'][:50]}...")
            print(f"    Answer: {q['answer']}, Options: {len(q['options'])}")
    
    # Save raw
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
    print(f"\nRaw saved to: {OUTPUT}")


if __name__ == '__main__':
    main()
