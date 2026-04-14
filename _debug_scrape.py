from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import time
url='https://cricheroes.com/tournament/1743603/pcl-mens-25/teams'
opts=Options()
opts.add_argument('--window-size=1920,1080')
# opts.add_argument('--headless=new')
d=webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
d.get(url)
time.sleep(10)
print('TITLE:', d.title)
print('URL:', d.current_url)
print('A tags:', len(d.find_elements(By.CSS_SELECTOR, 'a')))
for css in ["a[href*='/team-profile/']","a[href*='/team/']","a[href*='team-profile']","a[class*='team']"]:
    print(css, len(d.find_elements(By.CSS_SELECTOR, css)))
src=d.page_source
for token in ['/team-profile/','/team/','team-profile','teams-list','captcha','Cloudflare','cf-challenge']:
    print(token, token.lower() in src.lower())
for el in d.find_elements(By.CSS_SELECTOR, 'a')[:40]:
    h=(el.get_attribute('href') or '').strip()
    t=(el.text or '').strip().replace('\n',' ')
    if h:
        print('LINK', h, '|', t[:50])
d.quit()
