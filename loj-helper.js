// ==UserScript==
// @name         loj-helper
// @namespace    https://github.com/tzzl3035/loj-helper
// @version      1.9.1
// @description  在LOJ题目页面添加「复制Markdown」和「跳转Vjudge」按钮，支持工具栏折叠 | 暖灰底
// @author       tzzl3035
// @match        https://loj.ac/p/*
// @icon         https://vjudge.net/static/bundle/d319c0859f22922e76db.ico
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    console.log('[LOJ助手] 脚本已开始执行 (暖灰底)');

    // ========== 配置 ==========
    const CONFIG = {
        notificationDuration: 3000,
    };

    // ========== 日志 ==========
    const log = {
        info: (...args) => console.log('[LOJ助手]', ...args),
        warn: (...args) => console.warn('[LOJ助手]', ...args),
        error: (...args) => console.error('[LOJ助手]', ...args),
    };

    // ========== 工具 ==========

    function getProblemId() {
        const match = window.location.pathname.match(/\/(?:p|problem)\/(\d+)/);
        return match ? match[1] : null;
    }

    function getProblemTitle() {
        const titleEl = document.querySelector('h1.ui.header');
        if (titleEl) {
            let text = titleEl.textContent.trim();
            text = text.replace(/^#\d+\.\s*/, '');
            return text.trim();
        }
        const id = getProblemId();
        return id ? `LOJ #${id}` : 'Untitled Problem';
    }

    // ========== 核心解析器 ==========

    function getLeftContainer() {
        const statement = document.querySelector('[class*="_statementView_"]');
        if (!statement) {
            log.warn('未找到 statementView');
            return null;
        }
        const left = statement.querySelector('[class*="_leftContainer_"]');
        if (left) {
            log.info('找到左侧题面容器');
            return left;
        }
        const container = document.querySelector('.ui.container');
        if (container) {
            const header = container.querySelector('.ui.large.header');
            if (header && header.textContent.includes('题目描述')) {
                const parent = header.closest('div[class*="_leftContainer_"]');
                if (parent) return parent;
            }
        }
        log.warn('未找到左侧题面容器，将使用整个 statementView');
        return statement;
    }

    function domToMarkdown(el) {
        if (!el) return '';
        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        const lines = [];

        if (el.nodeType === Node.TEXT_NODE) {
            const text = el.textContent.trim();
            if (text) lines.push(text);
            return lines.join('\n');
        }

        if (el.classList) {
            if (el.classList.contains('ui') && (el.classList.contains('label') || el.classList.contains('button') || el.classList.contains('dropdown'))) {
                return '';
            }
            if (el.tagName === 'A' && el.textContent.includes('复制')) {
                return '';
            }
        }

        switch (tag) {
            case 'p': {
                const pText = el.textContent.trim();
                if (pText) lines.push(pText);
                break;
            }
            case 'pre': {
                const code = el.textContent;
                if (code.trim()) {
                    lines.push('```');
                    lines.push(code);
                    lines.push('```');
                }
                break;
            }
            case 'code': {
                if (el.parentElement && el.parentElement.tagName !== 'PRE') {
                    const inlineCode = el.textContent.trim();
                    if (inlineCode) lines.push(`\`${inlineCode}\``);
                }
                break;
            }
            case 'ul':
            case 'ol': {
                const items = el.querySelectorAll('li');
                for (const li of items) {
                    const liText = li.textContent.trim();
                    if (liText) {
                        const marker = tag === 'ol' ? '1. ' : '- ';
                        lines.push(`${marker}${liText}`);
                    }
                }
                break;
            }
            case 'table': {
                const rows = el.querySelectorAll('tr');
                if (rows.length > 0) {
                    const headerCells = rows[0].querySelectorAll('th, td');
                    const header = Array.from(headerCells).map(cell => cell.textContent.trim());
                    if (header.length > 0) {
                        lines.push('| ' + header.join(' | ') + ' |');
                        lines.push('| ' + header.map(() => '---').join(' | ') + ' |');
                        for (let i = 1; i < rows.length; i++) {
                            const cells = rows[i].querySelectorAll('td');
                            const row = Array.from(cells).map(cell => cell.textContent.trim());
                            if (row.length > 0) {
                                lines.push('| ' + row.join(' | ') + ' |');
                            }
                        }
                    }
                }
                break;
            }
            case 'div': {
                if (el.classList && el.classList.contains('equal') && el.classList.contains('width') && el.classList.contains('grid')) {
                    const sampleInput = el.querySelector('[class*="_sampleInput_"]');
                    const sampleOutput = el.querySelector('[class*="_sampleOutput_"]');

                    if (sampleInput) {
                        const inputHeader = sampleInput.querySelector('[class*="_sampleHeader_"]');
                        if (inputHeader) {
                            const headerText = inputHeader.textContent.replace('复制', '').trim();
                            if (headerText) lines.push(`**${headerText}**`);
                        }
                        const pre = sampleInput.querySelector('pre');
                        if (pre) {
                            lines.push('```');
                            lines.push(pre.textContent.trim());
                            lines.push('```');
                        }
                    }
                    if (sampleOutput) {
                        const outputHeader = sampleOutput.querySelector('[class*="_sampleHeader_"]');
                        if (outputHeader) {
                            const headerText = outputHeader.textContent.replace('复制', '').trim();
                            if (headerText) lines.push(`**${headerText}**`);
                        }
                        const pre = sampleOutput.querySelector('pre');
                        if (pre) {
                            lines.push('```');
                            lines.push(pre.textContent.trim());
                            lines.push('```');
                        }
                    }
                } else {
                    const children = Array.from(el.childNodes);
                    for (const child of children) {
                        const childMarkdown = domToMarkdown(child);
                        if (childMarkdown) lines.push(childMarkdown);
                    }
                }
                break;
            }
            default: {
                const children = Array.from(el.childNodes);
                for (const child of children) {
                    const childMarkdown = domToMarkdown(child);
                    if (childMarkdown) lines.push(childMarkdown);
                }
                break;
            }
        }

        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function parseSections(leftContainer) {
        if (!leftContainer) return [];

        const sections = [];
        let currentHeader = null;
        let currentElements = [];

        const children = Array.from(leftContainer.children);

        for (const child of children) {
            if (child.classList && child.classList.contains('ui') && child.classList.contains('large') && child.classList.contains('header')) {
                if (currentHeader && currentElements.length > 0) {
                    sections.push({
                        title: currentHeader.textContent.trim(),
                        content: currentElements
                    });
                }
                currentHeader = child;
                currentElements = [];
            } else {
                if (currentHeader) {
                    if (child.classList && child.classList.contains('ui') && child.classList.contains('label')) {
                        // skip
                    } else {
                        currentElements.push(child);
                    }
                }
            }
        }
        if (currentHeader && currentElements.length > 0) {
            sections.push({
                title: currentHeader.textContent.trim(),
                content: currentElements
            });
        }

        log.info(`解析到 ${sections.length} 个章节`);
        return sections;
    }

    function generateMarkdown() {
        const leftContainer = getLeftContainer();
        if (!leftContainer) {
            log.error('未找到题面左侧容器');
            return null;
        }

        const title = getProblemTitle();
        const sections = parseSections(leftContainer);

        const lines = [];
        lines.push(`# ${title}`);
        lines.push('');

        for (const section of sections) {
            const sectionTitle = section.title;
            if (sectionTitle) {
                let level = 3;
                if (sectionTitle === '题目描述') level = 2;
                else if (sectionTitle === '输入格式' || sectionTitle === '输出格式') level = 2;
                else if (sectionTitle === '样例') level = 2;
                else if (sectionTitle.startsWith('数据范围') || sectionTitle.startsWith('提示')) level = 2;
                else level = 3;
                const prefix = '#'.repeat(level);
                lines.push(`${prefix} ${sectionTitle}`);
                lines.push('');
            }

            for (const el of section.content) {
                const markdown = domToMarkdown(el);
                if (markdown) {
                    lines.push(markdown);
                    lines.push('');
                }
            }
        }

        const result = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        log.info(`生成 Markdown，长度 ${result.length} 字符`);
        return result;
    }

    // ========== 复制和通知 ==========

    function copyToClipboard(text) {
        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(text, 'text');
            return true;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
            return true;
        }
        fallbackCopy(text);
        return true;
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (e) {
            log.error('复制失败:', e);
        }
        document.body.removeChild(textarea);
    }

    function showNotification(message, type = 'info') {
        const nordColors = {
            info: '#5E81AC',
            success: '#A3BE8C',
            warning: '#EBCB8B',
            error: '#BF616A'
        };
        const el = document.createElement('div');
        el.style.cssText = `
            position: fixed;
            top: 80px;
            right: 24px;
            padding: 12px 24px;
            background: ${nordColors[type] || nordColors.info};
            color: #ECEFF4;
            border-radius: 8px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 999999;
            max-width: 400px;
            opacity: 0;
            transform: translateY(-10px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
        `;
        el.textContent = message;
        document.body.appendChild(el);
        requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 300);
        }, CONFIG.notificationDuration);
    }

    function jumpToVjudge() {
        const problemId = getProblemId();
        if (!problemId) {
            showNotification('无法获取题目编号', 'error');
            return;
        }
        const url = `https://vjudge.net/problem/LibreOJ-${problemId}`;
        log.info(`跳转到 VJudge: ${url}`);
        if (typeof GM_openInTab !== 'undefined') {
            GM_openInTab(url, { active: true });
        } else {
            window.open(url, '_blank');
        }
    }

    function handleCopyMarkdown() {
        const markdown = generateMarkdown();
        if (!markdown) {
            showNotification('生成 Markdown 失败，请检查控制台日志', 'error');
            return;
        }
        if (copyToClipboard(markdown)) {
            showNotification('✅ Markdown 已复制到剪贴板', 'success');
        } else {
            showNotification('复制失败，请手动复制', 'error');
        }
    }

    // ========== 工具栏（暖灰底） ==========

    function createButton(text, onClick, icon = '', style = 'primary') {
        const btn = document.createElement('button');
        btn.className = `loj-helper-btn loj-helper-btn-${style}`;
        btn.innerHTML = icon ? `<span class="loj-helper-icon">${icon}</span> ${text}` : text;
        btn.addEventListener('click', onClick);

        const colors = {
            primary: '#5E81AC',
            success: '#A3BE8C',
            warning: '#EBCB8B',
            danger: '#BF616A'
        };

        Object.assign(btn.style, {
            padding: '8px 12px',
            margin: '2px 0',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            backgroundColor: colors[style] || colors.primary,
            color: '#ECEFF4',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        });
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        });
        return btn;
    }

    function addToolbar() {
        if (document.querySelector('.loj-helper-toolbar')) {
            return;
        }

        const toolbar = document.createElement('div');
        toolbar.className = 'loj-helper-toolbar';
        Object.assign(toolbar.style, {
            position: 'fixed',
            top: '80px',
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '4px',
            padding: '8px',
            backgroundColor: '#bba898',      // 用户指定底色
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #8a7a6a',    // 适配边框
            zIndex: '999999',
            minWidth: '140px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            userSelect: 'none',
            transition: 'all 0.3s ease',
            overflow: 'hidden',
        });

        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'loj-helper-toggle';
        toggleBtn.textContent = '▼';
        Object.assign(toggleBtn.style, {
            textAlign: 'center',
            fontSize: '18px',
            lineHeight: '1',
            padding: '4px 0',
            cursor: 'pointer',
            color: '#2E3440',      // 深色文字
            transition: 'transform 0.3s ease',
            borderRadius: '4px',
        });
        toggleBtn.addEventListener('mouseenter', () => {
            toggleBtn.style.backgroundColor = '#c9b9a9';
        });
        toggleBtn.addEventListener('mouseleave', () => {
            toggleBtn.style.backgroundColor = 'transparent';
        });

        const contentArea = document.createElement('div');
        contentArea.className = 'loj-helper-content';
        Object.assign(contentArea.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            transition: 'max-height 0.3s ease, opacity 0.3s ease',
            maxHeight: '300px',
            opacity: '1',
            overflow: 'hidden',
        });

        const label = document.createElement('span');
        label.textContent = '⚡ 快捷操作';
        label.style.cssText = `
            display: block;
            text-align: center;
            font-size: 12px;
            color: #2E3440;
            margin: 2px 0 4px 0;
            font-weight: 500;
        `;
        contentArea.appendChild(label);

        const copyBtn = createButton('复制 Markdown', handleCopyMarkdown, '📋', 'primary');
        contentArea.appendChild(copyBtn);

        const vjudgeBtn = createButton('跳转 VJudge', jumpToVjudge, '🔗', 'success');
        contentArea.appendChild(vjudgeBtn);

        toolbar.appendChild(toggleBtn);
        toolbar.appendChild(contentArea);
        document.body.appendChild(toolbar);

        let collapsed = false;
        toggleBtn.addEventListener('click', () => {
            collapsed = !collapsed;
            if (collapsed) {
                contentArea.style.maxHeight = '0';
                contentArea.style.opacity = '0';
                contentArea.style.margin = '0';
                contentArea.style.padding = '0';
                toggleBtn.textContent = '▶';
                toolbar.style.minWidth = '36px';
                toolbar.style.padding = '6px';
            } else {
                contentArea.style.maxHeight = '300px';
                contentArea.style.opacity = '1';
                contentArea.style.margin = '';
                contentArea.style.padding = '';
                toggleBtn.textContent = '▼';
                toolbar.style.minWidth = '140px';
                toolbar.style.padding = '8px';
            }
        });

        const style = document.createElement('style');
        style.textContent = `
            .loj-helper-btn:active {
                transform: scale(0.95) !important;
            }
            .loj-helper-icon {
                font-size: 16px;
                line-height: 1;
            }
            @media (max-width: 768px) {
                .loj-helper-toolbar {
                    top: 70px !important;
                    right: 10px !important;
                }
                .loj-helper-btn {
                    font-size: 12px !important;
                    padding: 6px 10px !important;
                }
            }
        `;
        document.head.appendChild(style);
        log.info('工具栏已添加 (暖灰底)');
    }

    // ========== 初始化 ==========

    function init() {
        const path = window.location.pathname;
        if (!/^\/(?:p|problem)\/\d+/.test(path)) {
            return;
        }
        setTimeout(addToolbar, 300);
        log.info('初始化成功');
    }

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }

    let lastPath = window.location.pathname;
    setInterval(() => {
        const currentPath = window.location.pathname;
        if (currentPath !== lastPath) {
            lastPath = currentPath;
            if (/^\/(?:p|problem)\/\d+/.test(currentPath)) {
                const oldToolbar = document.querySelector('.loj-helper-toolbar');
                if (oldToolbar) oldToolbar.remove();
                setTimeout(init, 500);
            }
        }
    }, 1000);

    log.info('脚本加载完成，等待初始化... (暖灰底)');
})();
