"""Services registered as post-run hooks; importing this package registers them (order matters)."""
from app.pipeline import POST_RUN_HOOKS
from app.services.brief import write_brief
from app.services.proposals import persist_proposals
from app.services.specialist_summaries import write_specialist_summaries

for _hook in (persist_proposals, write_brief, write_specialist_summaries):
    if _hook not in POST_RUN_HOOKS:
        POST_RUN_HOOKS.append(_hook)

# Stage 3: the daily brief is written by Domo when available (grounded), else the template is kept.
from app.agent import brief_ai as _brief_ai  # noqa: E402
from app.services import brief as _brief  # noqa: E402

_brief.AI_WRITER = _brief_ai.write
