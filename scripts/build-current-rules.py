import json
import re
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
VERIFIED_AT = "2026-08-15"
CNU_BASE = "https://lib.cnu.edu.cn"
CNU_POLICY_URL = f"{CNU_BASE}/static/site/view/ai/com"

rules = []


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def infer_tag(text: str) -> str:
    if re.search(r"声明|披露|标识|引用|致谢|注释", text):
        return "声明与披露"
    if re.search(r"(?:AI|AIGC|人工智能).{0,8}(?:列为|作为|充当).{0,5}(?:作者|共同作者)|(?:作者|共同作者).{0,8}(?:AI|AIGC|人工智能)|作者身份", text, re.I):
        return "列AI为作者"
    if re.search(r"隐私|保密|敏感|安全|上传|泄露", text):
        return "数据隐私与安全"
    if re.search(r"图像|图表|音视频|封面|图文摘要|图片", text):
        return "图像与图表生成"
    if re.search(r"润色|翻译|语法|可读性|语言", text):
        return "语言润色与翻译"
    if re.search(r"参考文献|文献|引文|资料收集", text):
        return "文献检索与整理"
    if re.search(r"同行评|评审|审稿", text):
        return "同行评议与审稿"
    if re.search(r"数据|统计分析", text):
        return "数据分析与统计"
    if re.search(r"代写|整篇|全文|核心内容|核心创新", text):
        return "正文撰写与代写"
    if re.search(r"作业|课程", text):
        return "课程作业使用"
    if re.search(r"核实|核验|验证|幻觉|准确", text):
        return "批判性评估AI"
    return "伦理与合规"


def add(*, scene, action, verdict, level, quote, source, source_url, published_at="", tag=None, original_url=""):
    quote = clean(quote)
    if not quote:
        return
    rules.append({
        "id": len(rules),
        "scene": scene,
        "action": clean(action),
        "verdict": verdict,
        "level": level,
        "quote": quote,
        "source": source,
        "sourceUrl": source_url,
        "originalUrl": original_url,
        "publishedAt": published_at,
        "verifiedAt": VERIFIED_AT,
        "tag": tag or infer_tag(f"{action} {quote}"),
    })


def split_sentences(text: str):
    text = clean(text)
    return [clean(part) for part in re.findall(r"[^。；]+[。；]?", text) if clean(part)]


# Current CNU internal policy summaries: government and education.
ai_plus_url = f"{CNU_POLICY_URL}?chId=1930168046433902592&artId=1995307850481586176"
add(scene="日常学习", action="将人工智能融入教育教学全过程", verdict="允许", level="allow",
    quote="应把人工智能融入教育教学全要素、全过程，创新智能学伴、智能教师等人机协同教育教学新模式，推动育人从知识传授为重向能力提升为本转变，加快实现大规模因材施教，提高教育质量，促进教育公平。",
    source="国务院《关于深入实施“人工智能+”行动的意见》", source_url=ai_plus_url, published_at="2025-08-26")
add(scene="日常学习", action="开展智能化自主学习", verdict="允许", level="allow",
    quote="构建智能化情景交互学习模式，推动开展方式更灵活、资源更丰富的自主学习。",
    source="国务院《关于深入实施“人工智能+”行动的意见》", source_url=ai_plus_url, published_at="2025-08-26", tag="日常学习辅助")
add(scene="日常学习", action="学习人工智能知识与技术", verdict="允许", level="allow",
    quote="鼓励和支持全民积极学习人工智能新知识、新技术。",
    source="国务院《关于深入实施“人工智能+”行动的意见》", source_url=ai_plus_url, published_at="2025-08-26", tag="AI素养与规范使用")

digital_url = f"{CNU_POLICY_URL}?chId=1930168046433902592&artId=1995314745862836224"
add(scene="通用", action="推进人工智能助力教育变革", verdict="允许", level="allow",
    quote="《意见》提出全面推进智能化，促进人工智能助力教育变革。",
    source="教育部等九部门《关于加快推进教育数字化的意见》", source_url=digital_url, published_at="2025-04-15", tag="AI素养与规范使用")
add(scene="日常学习", action="提升师生数字素养与技能", verdict="允许", level="allow",
    quote="以师生为重点提升全民数字素养与技能。",
    source="教育部等九部门《关于加快推进教育数字化的意见》", source_url=digital_url, published_at="2025-04-15", tag="AI素养与规范使用")

# Current national generated-content labeling rules linked from CNU.
label_url = "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm"
add(scene="通用", action="发布生成合成内容时主动声明", verdict="有限使用", level="caution",
    quote="用户使用网络信息内容传播服务发布生成合成内容的，应当主动声明并使用服务提供者提供的标识功能进行标识。",
    source="《人工智能生成合成内容标识办法》第十条", source_url=label_url, published_at="2025-03-07", tag="声明与披露")
add(scene="通用", action="删除、篡改或隐匿生成内容标识", verdict="禁止", level="forbid",
    quote="任何组织和个人不得恶意删除、篡改、伪造、隐匿本办法规定的生成合成内容标识，不得为他人实施上述恶意行为提供工具或者服务，不得通过不正当标识手段损害他人合法权益。",
    source="《人工智能生成合成内容标识办法》第十条", source_url=label_url, published_at="2025-03-07", tag="声明与披露")

# Tsinghua guidance, newly listed by the current CNU page.
tsinghua_url = f"{CNU_POLICY_URL}?chId=1930168046433902592&artId=1995320297980481536"
tsinghua_source = "《清华大学人工智能教育应用指导原则》"
tsinghua_rules = [
    ("通用", "坚持师生主体责任", "有限使用", "caution", "主体责任：强调人工智能始终是辅助工具，师生才是教学与学习的主导者。", "AI素养与规范使用"),
    ("通用", "披露人工智能使用情况", "有限使用", "caution", "合规诚信：要求师生对人工智能使用情况及生成内容依规进行披露声明，严禁学术不端。", "声明与披露"),
    ("通用", "使用敏感、涉密或未授权数据驱动模型", "禁止", "forbid", "数据安全：严禁师生使用敏感信息、涉密数据或未授权数据训练或驱动人工智能模型。", "数据隐私与安全"),
    ("通用", "多源验证人工智能输出", "有限使用", "caution", "审慎思辨：提醒师生警惕人工智能“幻觉”，应通过多源验证防范因过度依赖导致的思维惰化。", "批判性评估AI"),
    ("通用", "识别算法偏见与数字鸿沟", "有限使用", "caution", "公平包容：呼吁主动识别并努力降低算法偏见与数字鸿沟，推动技术向善。", "伦理与合规"),
    ("课程作业", "遵守课程规定探索AI辅助学习", "有限使用", "caution", "“教学篇”鼓励同学们在遵守课程规定的前提下积极探索人工智能工具辅助学习。", "课程作业使用"),
    ("课程作业", "直接复制或简单转述AI内容提交", "禁止", "forbid", "严禁将人工智能生成的文本、代码等内容直接复制或简单转述后作为学业成果提交。", "正文撰写与代写"),
    ("本科毕业论文", "用AI替代本人学术训练", "禁止", "forbid", "禁止用人工智能代替本应由本人进行的学术训练。", "正文撰写与代写"),
    ("本科毕业论文", "使用AI代写、剽窃或伪造", "禁止", "forbid", "严禁使用人工智能实施代写、剽窃、伪造等行为。", "学术诚信违规"),
]
for scene, action, verdict, level, quote, tag in tsinghua_rules:
    add(scene=scene, action=action, verdict=verdict, level=level, quote=quote, source=tsinghua_source,
        source_url=tsinghua_url, published_at="2025-11-26", tag=tag)

# Shanghai Jiao Tong University teacher guidance, independently re-extracted from the live PDF.
sjtu_url = "https://ctld.sjtu.edu.cn/storage/file/2024/06/41f76c41d972b32fa344023b5663b275.pdf"
sjtu_source = "上海交通大学《规范学生使用人工智能工具的教师指南》"
sjtu_rules = [
    ("除非教师明确授权，否则AI平台不能用于课程作业", "禁止", "forbid", "AI 平台属于在线学习支持平台的一种。除非教师明确授权，否则它们不能用于课程作业。"),
    ("向未经授权的平台提交作业题", "禁止", "forbid", "不允许向未经授权的在线学习支持平台提交全部或部分作业题。"),
    ("把AI生成内容整合进作业", "禁止", "forbid", "禁止将 AI 生成的任何内容整合到作业中。"),
    ("用AI为作业头脑风暴或形成论点", "禁止", "forbid", "禁止在作业中使用 AI 进行头脑风暴、形成论点或提出创意。"),
    ("用AI总结或解读课程资料", "禁止", "forbid", "不允许使用 AI 对课程资料进行总结或情境化解读。"),
    ("把作业提交给AI迭代改进", "禁止", "forbid", "禁止将作业提交给 AI 进行迭代或改进。"),
    ("按教师指定的作业类型使用AI", "有限使用", "caution", "AI 工具可用于作业类型 A，B 和 C，但不可用于作业类型 D，E 和 F。"),
    ("恰当说明或引用AI使用", "有限使用", "caution", "使用 AI 需要恰当说明或引用。"),
    ("评估AI输出并承担最终责任", "有限使用", "caution", "使用 AI 过程中，需要负责评估 AI 输出的有效性和适用性，并承担最终责任。"),
    ("教师允许自由使用时仍需引用", "有限使用", "caution", "AI 可用于任何作业，但必须恰当说明或引用。"),
    ("说明AI如何用于作业", "有限使用", "caution", "请用 200 字以内的语言来描述你如何将 AI 应用于你的作业及课后任务。"),
    ("核查AI生成的参考文献", "有限使用", "caution", "尽管 AI 能生成看似真实的引文，但内容可能来自虚构的文献。要求学生注明引用来源并审查这些引文，是发现 AI 是否被恰当使用的有效方法。"),
    ("把AI检测结果作为充分证据", "禁止", "forbid", "大多数“AI 检测工具”都不够准确，无法作为学生使用 AI 的充分证据。"),
]
for action, verdict, level, quote in sjtu_rules:
    add(scene="课程作业", action=action, verdict=verdict, level=level, quote=quote, source=sjtu_source,
        source_url=sjtu_url, published_at="2024-06-10", tag={
            "除非教师明确授权，否则AI平台不能用于课程作业": "课程作业使用",
            "向未经授权的平台提交作业题": "课程作业使用",
            "把AI生成内容整合进作业": "课程作业使用",
            "用AI为作业头脑风暴或形成论点": "课程作业使用",
            "用AI总结或解读课程资料": "课程作业使用",
            "把作业提交给AI迭代改进": "课程作业使用",
            "按教师指定的作业类型使用AI": "课程作业使用",
            "恰当说明或引用AI使用": "声明与披露",
            "评估AI输出并承担最终责任": "批判性评估AI",
            "教师允许自由使用时仍需引用": "声明与披露",
            "说明AI如何用于作业": "声明与披露",
            "核查AI生成的参考文献": "文献检索与整理",
            "把AI检测结果作为充分证据": "批判性评估AI",
        }[action])

# CAS eight integrity reminders linked by the current CNU page.
cas_url = "https://www.cas.cn/cm/202409/t20240911_5031204.shtml"
cas_source = "中国科学院科研道德委员会《关于在科研活动中规范使用人工智能技术的诚信提醒》"
cas_quotes = [
    "提醒一：在选题调研、文献检索、资料整理时，可借助人工智能技术跟踪研究动态，收集整理参考文献，并对人工智能生成信息的真实性、准确性、可靠性进行辨识；反对直接使用未经核实的由人工智能生成的调研报告、选题建议、文献综述等。",
    "提醒二：在申报材料撰写时，如使用了由人工智能生成的内容，应对内容负责，并全面如实声明使用情况；反对直接使用未经核实的由人工智能生成的申报材料。",
    "提醒三：在数据收集和使用时，如使用了由人工智能生成的模拟仿真数据、测试数据等，或使用人工智能技术对原始数据进行统计分析，应全面如实声明使用情况；反对将人工智能生成的数据作为实验数据。",
    "提醒四：在音视频和图表制作时，可利用人工智能技术辅助完成，应对生成内容进行标识，并全面如实声明使用情况；反对使用人工智能直接生成音视频和图表。",
    "提醒五：在成果撰写时，可使用人工智能技术辅助整理已有的理论、材料与方法等，可进行语言润色、翻译、规范化检查；反对将人工智能生成内容作为核心创新成果，反对使用人工智能生成整篇成果及参考文献。",
    "提醒六：在同行评议中，反对使用人工智能技术撰写同行评议意见，不得将评议信息上传至未经评议组织者认可的工具平台。",
    "提醒七：在科研活动中，如使用人工智能技术，应在注释、致谢、参考文献或附录等部分声明工具的名称、版本、日期及使用过程；反对未加声明直接使用。",
    "提醒八：在选择人工智能技术时，应使用经国家备案登记的服务工具；反对滥用人工智能技术危害数据安全，侵犯知识产权，泄露个人隐私等。",
]
cas_actions = ["核验AI生成的调研与文献材料", "核验并声明AI生成的申报材料", "声明AI生成或分析的数据", "标识并声明AI辅助音视频和图表", "限制AI参与成果撰写", "同行评议中使用AI", "披露科研活动中的AI使用", "选用备案工具并保护安全隐私"]
cas_tags = ["文献检索与整理", "声明与披露", "数据分析与统计", "图像与图表生成", "正文撰写与代写", "同行评议与审稿", "声明与披露", "数据隐私与安全"]
for action, quote, tag in zip(cas_actions, cas_quotes, cas_tags):
    add(scene="科研活动", action=action, verdict="有限使用", level="caution", quote=quote, source=cas_source,
        source_url=cas_url, published_at="2024-09-10", tag=tag)

# AIGC 3.0: parse the current CNU-hosted table rather than the old 243-rule array.
aigc_html = Path("/tmp/cnu-art-aigc-guide-3.html").read_text()
aigc_soup = BeautifulSoup(aigc_html, "html.parser")
aigc_url = f"{CNU_POLICY_URL}?chId=1930168046433902592&artId=1998209416947625984"
aigc_source = "《学术出版中AIGC使用边界指南3.0》"
current_stage = "科研活动"
for row in aigc_soup.select(".siteTplBox table tr")[1:]:
    cells = [clean(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"], recursive=False)]
    if len(cells) == 4:
        current_stage, behavior, limited_text, caution_text = cells
    elif len(cells) == 3:
        behavior, limited_text, caution_text = cells
    else:
        continue
    for sentence in split_sentences(limited_text):
        add(scene="科研活动", action=f"{behavior}：限制使用", verdict="有限使用", level="caution", quote=sentence,
            source=aigc_source, source_url=aigc_url, published_at="2025-12-08")
    for sentence in split_sentences(caution_text):
        forbidden = bool(re.search(r"禁止|不得|不可|不能被列为|不应将", sentence))
        add(scene="科研活动", action=f"{behavior}：{'禁止事项' if forbidden else '注意事项'}",
            verdict="禁止" if forbidden else "有限使用", level="forbid" if forbidden else "caution", quote=sentence,
            source=aigc_source, source_url=aigc_url, published_at="2025-12-08")

# Publisher policies: use the current CNU page summaries and retain the original publisher links.
audit = json.loads((ROOT / "work/current-policy-audit.json").read_text())
publisher_page_url = f"{CNU_POLICY_URL}?chId=1930168046433902592&artId=1932292760073715712"
for publisher in audit["publisherPolicies"]:
    name = publisher["publisher"]
    for clause in publisher["clauses"]:
        label_match = re.match(r"([^:：]{1,10})[:：]", clause)
        label = label_match.group(1) if label_match else "使用规定"
        forbidden = bool(re.search(r"^(?:图像|图文摘要)?[:：]?\s*(?:禁止|不允许)|必须获得.*许可", clause))
        add(scene="科研活动", action=f"{name}：{label}", verdict="禁止" if forbidden else "有限使用",
            level="forbid" if forbidden else "caution", quote=clause, source=f"首都师范大学图书馆整理：{name}",
            source_url=publisher_page_url, original_url=publisher["url"], published_at="2026-01")

(ROOT / "app/rules.json").write_text(json.dumps(rules, ensure_ascii=False, indent=2))

preferred_urls = {
    "国际图联“图书馆与人工智能”的切入点": "https://www.ifla.org/entry-point-for-libraries-and-ai/",
    "清华大学人工智能教育应用指导原则": tsinghua_url,
    "北京工商大学": "https://jwc.btbu.edu.cn/jwkw/bylw/8f1919d29e8f4608a822f705ba50fc45.htm",
    "学术出版中AIGC使用边界指南 3.0": aigc_url,
}

catalogue_documents = []
for document in audit["currentEntries"]:
    current = dict(document)
    current["preferredUrl"] = next(
        (url for title, url in preferred_urls.items() if title in document["text"]),
        document["links"][-1] if document["links"] else CNU_POLICY_URL,
    )
    catalogue_documents.append(current)

catalogue = {
    "retrievedAt": audit["snapshot"]["retrievedAt"],
    "mainArticleDate": audit["snapshot"]["mainArticleDate"],
    "sourceUrl": CNU_POLICY_URL,
    "documents": catalogue_documents,
    "publisherPolicies": audit["publisherPolicies"],
}
(ROOT / "app/policies.json").write_text(json.dumps(catalogue, ensure_ascii=False, indent=2))

print(json.dumps({
    "ruleCount": len(rules),
    "levelCounts": {level: sum(1 for item in rules if item["level"] == level) for level in ["forbid", "caution", "allow"]},
    "sceneCounts": {scene: sum(1 for item in rules if item["scene"] == scene) for scene in sorted({item["scene"] for item in rules})},
    "topicCount": len({item["tag"] for item in rules}),
    "documentCount": len(catalogue["documents"]),
    "publisherCount": len(catalogue["publisherPolicies"]),
}, ensure_ascii=False, indent=2))
