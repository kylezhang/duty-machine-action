
let { Octokit } = require('@octokit/rest')
let fetchArticle = require('./src/fetchArticle')
let renderToMarkdown = require('./src/renderToMarkdown')
let fetch = require('node-fetch')
const moment = require('moment')

require('dotenv').config()

const header = `---
language: zh-CN
toc: true
thumbnail: https://random.imagecdn.app/500/150
cover: https://random.imagecdn.app/500/150
date: ${moment().format('YYYY-MM-DD HH:mm')}
categories:
    - '转载'
tags:
    - '转载'
---`


const footer = `> 文章转自：`

let TOKEN = process.env.TOKEN
let REPOSITORY = process.env.REPOSITORY
let EVENT = process.env.EVENT
let [OWNER, REPO] = REPOSITORY.split('/')

let octokit = new Octokit({
  auth: TOKEN
})

function checkSubmission(body) {
  //if (body.split("\n").length > 1) return false
  return true
}

async function getTasks() {
  if (EVENT) {
    console.log('getting single task')
    return [JSON.parse(EVENT).issue]
  } else {
    console.log('getting list of tasks')
    let { data } = await octokit.issues.listForRepo({
      owner: OWNER,
      repo: REPO,
      state: 'open'
    })
    return data
  }
}

async function performTasks(list) {
  let promises = list.map(async (issue) => {
    try {
      if (!checkSubmission(issue.body || issue.title)) {
        throw "Invalid submission"
      }
      let url = issue.body || issue.title
      let resp = await fetch(url)
      let articleData = await fetchArticle(resp.url)
      // await octokit.issues.createComment({
      //   owner: OWNER,
      //   repo: REPO,
      //   issue_number: issue.number,
      //   body: renderToMarkdown(articleData)
      // })
      await octokit.issues.update({
        owner: OWNER,
        repo: REPO,
        issue_number: issue.number,
        title: articleData.title,
        body: `${header}\n${renderToMarkdown(articleData)}\n${footer}[${articleData.title}](${url})`,
        labels: ['fetched', 'copied', 'publish'],
        state: 'closed'
      })
      // octokit.rest.issues.removeLabel({
      //   owner: OWNER,
      //   repo: REPO,
      //   issue_number: issue.number,
      //   name: 'copy',
      // });
    } catch(error) {
      await octokit.issues.createComment({
        owner: OWNER,
        repo: REPO,
        issue_number: issue.number,
        body: `错误 ${error.toString()}`
      })
      await octokit.issues.update({
        owner: OWNER,
        repo: REPO,
        issue_number: issue.number,
        state: 'closed',
        labels: ['error']
      })
      throw error
    }
  })

  await Promise.all(promises)
}

async function perform() {
  let tasks = await getTasks()
  await performTasks(tasks)
}

perform()
