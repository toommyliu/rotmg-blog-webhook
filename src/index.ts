import 'dotenv/config';

import { APIEmbed, hideLinkEmbed, WebhookClient } from 'discord.js';
import { get } from 'httpie';
import { parse } from 'node-html-parser';
import { blogUrl, userAgent } from './constants.js';
import { logger } from './logger.js';

let lastArticleId: number | undefined;

const client = new WebhookClient({
	id: process.env.WEBHOOK_ID!,
	token: process.env.WEBHOOK_TOKEN!,
});

async function check() {
	logger.info('checking blog');

	const req = await get(blogUrl, {
		headers: {
			'user-agent': userAgent,
		},
	});

	const dom = parse(req.data as string, {
		blockTextElements: {
			script: false,
			noscript: false,
			style: false,
		},
	});

	const latestArticle = dom.querySelector('#blog-article');
	if (latestArticle) {
		// @ts-expect-error
		const articleId = latestArticle.childNodes[1].id as string;
		const articleId_ = parseInt(articleId.split('-')[1], 10);

		if (lastArticleId === articleId_) return logger.info('no new article');

		const articleUrl = `https://remaster.realmofthemadgod.com/?p=${articleId_}`;
		const req = await get(articleUrl, {
			headers: {
				'user-agent': userAgent,
			},
		});

		const dom = parse(req.data as string, {
			blockTextElements: {
				script: false,
				noscript: false,
				style: false,
			},
		});

		const article = dom.querySelector(`#blog-post #${articleId}`)!;
		const articleTitle = article.querySelector('.entry-title')!.text;
		const articleDate = article.querySelector('.entry-content .posted-on .entry-date.published')!.text;
		const pArr = article.querySelectorAll('p');
		const articleDescription = [];

		const embed: APIEmbed = {
			title: articleTitle,
			timestamp: new Date(articleDate).toISOString(),
			url: articleUrl,
		};

		for (let i = 0; i < 3; i++) {
			const p = pArr[i];
			switch (i) {
				case 0:
					{
						const img = p.getElementsByTagName('img')[0].rawAttributes.src;
						embed.image = { url: img };
					}
					break;
				case 1:
				case 2:
					{
						const text = p.text;
						articleDescription.push(text);
					}
					break;
			}
		}

		embed.description = articleDescription.join('\n\n');
		await client.send({ content: `${hideLinkEmbed(articleUrl)}`, embeds: [embed] });

		logger.info(`webhook sent for article ${articleId_}`);
		lastArticleId = articleId_;
	}
}

void check();
setInterval(() => void check(), 60_000 * 15);
