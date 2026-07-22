const penguin = document.querySelector('#penguin');
const layer = document.querySelector('#candyLayer');
const countLabel = document.querySelector('#count');
const message = document.querySelector('#message');
const reset = document.querySelector('#reset');

const messages = [
  '汐遙今天也被月光喜歡著。',
  '小企鵝把最亮的一顆留給妳。',
  '海風捎來一顆甜甜的星星。',
  'Solure 的夜晚正在輕輕發光。',
  '這顆糖裡藏著一個小小的抱抱。',
  '月光湖替妳保管今天的好心情。'
];

let count = Number(localStorage.getItem('solureCandyCount') || 0);
countLabel.textContent = count;

function makeCandy(x, y, rare = false) {
  const candy = document.createElement('span');
  candy.className = `candy${rare ? ' rare' : ''}`;
  candy.style.left = `${x}px`;
  candy.style.top = `${y}px`;
  candy.style.setProperty('--size', `${rare ? 34 : 20 + Math.random() * 14}px`);
  candy.style.setProperty('--rotate', `${Math.random() * 120 - 60}deg`);
  candy.style.setProperty('--drift', `${Math.random() * 90 - 45}px`);
  candy.style.setProperty('--drift-end', `${Math.random() * 210 - 105}px`);
  candy.style.setProperty('--duration', `${1.8 + Math.random() * .7}s`);
  layer.append(candy);
  candy.addEventListener('animationend', () => candy.remove());
}

function dropCandy() {
  const rect = penguin.getBoundingClientRect();
  const rare = (count + 1) % 5 === 0;
  const amount = rare ? 7 : 3;

  for (let i = 0; i < amount; i += 1) {
    setTimeout(() => {
      makeCandy(
        rect.left + rect.width / 2 + (Math.random() * 54 - 27),
        rect.top + rect.height * .36,
        rare && i === 0
      );
    }, i * 65);
  }

  count += 1;
  localStorage.setItem('solureCandyCount', String(count));
  countLabel.textContent = count;
  message.textContent = rare
    ? '粉紫色的稀有月光糖出現了！'
    : messages[Math.floor(Math.random() * messages.length)];

  penguin.classList.remove('pop');
  void penguin.offsetWidth;
  penguin.classList.add('pop');
}

penguin.addEventListener('click', dropCandy);
penguin.addEventListener('animationend', event => {
  if (event.animationName === 'boop') penguin.classList.remove('pop');
});

reset.addEventListener('click', () => {
  count = 0;
  localStorage.removeItem('solureCandyCount');
  countLabel.textContent = '0';
  message.textContent = '糖糖回到月光盒裡，等待下一次相遇。';
});
