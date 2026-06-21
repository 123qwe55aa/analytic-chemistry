#!/usr/bin/env python3
"""Extract questions from Chaoxing homework HTML exports and output as structured JSON."""
import re, json, os, html
from collections import OrderedDict

HOMEWORK_DIR = "/Users/toby/Documents/Projects/03_research-labs/analytic chemistry/site/homework"
OUTPUT = "/Users/toby/Documents/Projects/03_research-labs/analytic chemistry/site/data/homework-quiz.json"

def extract_homework_questions(filepath, source_label):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove all <script> blocks (they contain noise)
    content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
    
    questions = []
    
    # Find all question blocks
    # Each question is inside a div with class "questionLi"
    blocks = re.findall(r'<div[^>]*class="[^"]*marBom60\s+questionLi[^"]*"[^>]*id="question(\d+)"[^>]*>(.*?)</div>\s*(?=<div[^>]*class="[^"]*marBom60\s+questionLi|$)', content, re.DOTALL)
    
    if not blocks:
        # Try alternate pattern
        blocks = re.findall(r'<div[^>]*class="[^"]*questionLi[^"]*"[^>]*id="question(\d+)"[^>]*>(.*?)</div>\s*(?=<div[^>]*class="[^"]*questionLi|$)', content, re.DOTALL)
    
    for qid, block in blocks:
        # Determine question type
        qtype = ""
        qt_match = re.search(r'<span class="colorShallow">\((\w+)\)</span>', block)
        if qt_match:
            qtype = qt_match.group(1)
        
        # Extract question text
        qt_text_match = re.search(r'<span class="qtContent workTextWrap">(.*?)</span>', block, re.DOTALL)
        if not qt_text_match:
            continue
        question_text = strip_html(qt_text_match.group(1)).strip()
        if not question_text:
            continue
        
        # Extract options
        options = []
        li_matches = re.findall(r'<li[^>]*class="[^"]*workTextWrap[^"]*"[^>]*>(.*?)</li>', block, re.DOTALL)
        for li in li_matches:
            opt_text = strip_html(li).strip()
            if opt_text:
                options.append(opt_text)
        
        # If it's a 判断题 (true/false), create options
        if qtype == '判断题' and not options:
            options = ['正确', '错误']
        
        # Extract correct answer
        correct_match = re.search(r'<span class="rightAnswerContent[^"]*"[^>]*>(.*?)</span>', block, re.DOTALL)
        correct_answer = ""
        if correct_match:
            correct_answer = strip_html(correct_match.group(1)).strip()
        
        # If it's 判断题, map the answer
        if qtype == '判断题':
            if correct_answer in ('对', '正确', 'T', 'true', 'True', '√'):
                correct_answer = '正确'
            elif correct_answer in ('错', '错误', 'F', 'false', 'False', '×'):
                correct_answer = '错误'
        
        questions.append({
            'id': f'hw-{source_label}-{qid}',
            'source': source_label,
            'type': qtype,
            'question': question_text,
            'options': options,
            'answer': correct_answer
        })
    
    return questions


def strip_html(text):
    """Remove HTML tags and decode entities."""
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def convert_to_quiz_format(questions, offset=0):
    """Convert extracted questions to the existing quiz.json format."""
    quiz_questions = []
    for i, q in enumerate(questions):
        qtype = q['type']
        
        if qtype == '单选题':
            options = []
            # Map A, B, C, D to options
            for j, opt in enumerate(q['options']):
                options.append({
                    'text': opt,
                    'isCorrect': chr(65 + j) == q['answer'].strip().upper() if q['answer'] else False,
                    'rationale': ''
                })
            
            quiz_questions.append({
                'id': f'hw{offset + i + 1:03d}',
                'chapter': 'homework',
                'topic': q.get('source', 'homework'),
                'difficulty': 2,
                'question': q['question'],
                'answerOptions': options,
                'hint': ''
            })
        
        elif qtype == '多选题':
            options = []
            correct_set = set()
            ans = q['answer'].strip().upper()
            # Multi-select answers like "ABC" or "A,B,C" or "A B C"
            ans = re.sub(r'[,;，；\s]+', '', ans)
            for ch in ans:
                correct_set.add(ch)
            
            for j, opt in enumerate(q['options']):
                options.append({
                    'text': opt,
                    'isCorrect': chr(65 + j) in correct_set,
                    'rationale': ''
                })
            
            quiz_questions.append({
                'id': f'hw{offset + i + 1:03d}',
                'chapter': 'homework',
                'topic': q.get('source', 'homework') + '_multi',
                'difficulty': 3,
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
            
            quiz_questions.append({
                'id': f'hw{offset + i + 1:03d}',
                'chapter': 'homework',
                'topic': q.get('source', 'homework'),
                'difficulty': 2,
                'question': q['question'],
                'answerOptions': options,
                'hint': ''
            })
        
        else:
            # Skip other types (填空题, 问答题)
            continue
    
    return quiz_questions


def main():
    all_questions = []
    files = [
        ('作业详情.html', 'hw1'),
        ('作业详情1.html', 'hw2'),
        ('作业详情2.html', 'hw3'),
        ('作业详情3.html', 'hw4'),
        ('查看详情.html', 'view1'),
        ('查看详情1.html', 'view2'),
        ('查看详情2.html', 'view3'),
    ]
    
    for fname, label in files:
        fpath = os.path.join(HOMEWORK_DIR, fname)
        if os.path.exists(fpath):
            qs = extract_homework_questions(fpath, label)
            print(f"  {fname}: {len(qs)} questions extracted")
            all_questions.extend(qs)
        else:
            print(f"  {fname}: NOT FOUND")
    
    print(f"\nTotal extracted: {len(all_questions)} questions")
    
    # Print type breakdown
    from collections import Counter
    type_counts = Counter(q['type'] for q in all_questions)
    for t, c in type_counts.most_common():
        print(f"  {t}: {c}")
    
    # Convert to quiz format
    quiz_data = convert_to_quiz_format(all_questions)
    print(f"\nConverted to quiz format: {len(quiz_data)} questions")
    
    # Output JSON
    result = {
        'title': 'Homework Quiz / 平时作业',
        'questions': quiz_data
    }
    
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\nSaved to: {OUTPUT}")
    
    # Also output a simple list for reference
    print("\n=== Question Preview ===")
    for q in quiz_data[:5]:
        print(f"  {q['id']}: {q['question'][:60]}...")


if __name__ == '__main__':
    main()
