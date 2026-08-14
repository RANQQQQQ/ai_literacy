export function isAssistantHelpQuestion(question) {
  return /(?:你是谁|你是什么|介绍(?:一下)?你自己|能做什么|可以做什么|怎么用|如何使用|使用帮助|who are you|what (?:can|do) you do|how (?:do i|to) use)/i.test(question);
}

export function parseRuleIds(value) {
  const raw = value?.trim() || "";
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((id) => Number.isInteger(id) && id >= 0);
}
