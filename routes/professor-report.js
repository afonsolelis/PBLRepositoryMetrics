/**
 * Professor Report Route
 *
 * Provides raw per-member data as a subsidy for the professor/advisor.
 * No scores, no rankings, no judgments — just data for human interpretation.
 * The complete evaluation is made by the professor; this report supports it.
 */
const express = require('express');
const router  = express.Router();
const { getDB } = require('../config/db');

router.get('/:id', async (req, res) => {
  const db = getDB();
  const projectId = parseInt(req.params.id);

  const [project, members, commits, mrs, issues] = await Promise.all([
    db.collection('projects').findOne({ project_id: projectId }),
    db.collection('members').find({ project_id: projectId }).toArray(),
    db.collection('commits').find({ project_id: projectId }).sort({ committed_date: -1 }).toArray(),
    db.collection('merge_requests').find({ project_id: projectId }).sort({ created_at: -1 }).toArray(),
    db.collection('issues').find({ project_id: projectId }).sort({ created_at: -1 }).toArray(),
  ]);

  if (!project) return res.status(404).render('pages/404');

  // Build per-member raw data (no scoring, no ranking)
  const memberData = members.map(m => {
    const memberCommits = commits.filter(c =>
      c.author_name === m.name || c.author_name?.toLowerCase().includes(m.username?.toLowerCase())
    );
    const memberMRs = mrs.filter(mr =>
      mr.author_username === m.username || mr.author_name === m.name
    );
    const memberIssues = issues.filter(i =>
      (i.assignees || []).some(a => a.username === m.username)
    );

    return {
      name: m.name,
      username: m.username,
      access_level: m.access_level,
      commits: memberCommits,
      commit_count: memberCommits.length,
      mrs: memberMRs,
      mr_count: memberMRs.length,
      issues: memberIssues,
      issue_count: memberIssues.length,
    };
  });

  res.render('pages/professor-report', {
    project,
    members: memberData,
    totals: {
      commits: commits.length,
      mrs: mrs.length,
      issues: issues.length,
    },
  });
});

module.exports = router;
