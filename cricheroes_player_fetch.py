from __future__ import annotations

import argparse
import csv
import re
import time
from pathlib import Path
from typing import Dict, List, Set
from urllib.parse import unquote, urlparse

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


# Use a page that contains links to team profiles (not live matches page).
DEFAULT_START_URL = (
    "https://cricheroes.com/tournament/1743603/pcl-mens-25/teams"
)
DEFAULT_OUTPUT = "player_urls.txt"
DEFAULT_IMPORT_CSV = "players_import.csv"
DEFAULT_STATS_CSV = "players_career_stats.csv"

STATS_FIELDS = [
    "player_id",
    "player_url",
    "stats_url",
    "player_name_clean",
    "bat_matches",
    "bat_innings",
    "bat_not_out",
    "bat_runs",
    "bat_highest_runs",
    "bat_avg",
    "bat_sr",
    "bat_30s",
    "bat_50s",
    "bat_100s",
    "bat_4s",
    "bat_6s",
    "bowl_matches",
    "bowl_innings",
    "bowl_overs",
    "bowl_maidens",
    "bowl_wickets",
    "bowl_runs_conceded",
    "bowl_best_bowling",
    "bowl_3w",
    "bowl_5w",
    "bowl_economy",
    "bowl_avg",
    "bowl_sr",
    "bowl_wides",
    "bowl_noballs",
    "bowl_dot_balls",
    "bowl_4s",
    "bowl_6s",
    "field_matches",
    "field_catches",
    "field_stumpings",
    "field_run_outs",
    "field_assisted_run_outs",
    "field_caught_behind",
]

TAB_FIELD_MAP = {
    "batting": {
        "matches": "bat_matches",
        "innings": "bat_innings",
        "not out": "bat_not_out",
        "runs": "bat_runs",
        "highest runs": "bat_highest_runs",
        "hs": "bat_highest_runs",
        "avg": "bat_avg",
        "sr": "bat_sr",
        "30s": "bat_30s",
        "50s": "bat_50s",
        "100s": "bat_100s",
        "4s": "bat_4s",
        "6s": "bat_6s",
    },
    "bowling": {
        "matches": "bowl_matches",
        "innings": "bowl_innings",
        "overs": "bowl_overs",
        "maidens": "bowl_maidens",
        "wickets": "bowl_wickets",
        "runs": "bowl_runs_conceded",
        "best bowling": "bowl_best_bowling",
        "3 wickets": "bowl_3w",
        "5 wickets": "bowl_5w",
        "economy": "bowl_economy",
        "avg": "bowl_avg",
        "sr": "bowl_sr",
        "wides": "bowl_wides",
        "noballs": "bowl_noballs",
        "dot balls": "bowl_dot_balls",
        "4s": "bowl_4s",
        "6s": "bowl_6s",
    },
    "fielding": {
        "matches": "field_matches",
        "catches": "field_catches",
        "stumpings": "field_stumpings",
        "run outs": "field_run_outs",
        "assisted run outs": "field_assisted_run_outs",
        "caught behind": "field_caught_behind",
    },
}


def create_driver(
    headless: bool,
    user_data_dir: str | None = None,
    profile_directory: str | None = None,
    debugger_address: str | None = None,
) -> webdriver.Chrome:
    options = Options()
    if headless and not debugger_address:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--log-level=3")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    )
    if not debugger_address:
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
    if user_data_dir and not debugger_address:
        options.add_argument(f"--user-data-dir={user_data_dir}")
    if profile_directory and not debugger_address:
        options.add_argument(f"--profile-directory={profile_directory}")
    if debugger_address:
        options.add_experimental_option("debuggerAddress", debugger_address)
    driver = webdriver.Chrome(service=Service(), options=options)
    if not debugger_address:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": """
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                """,
            },
        )
    return driver


def wait_for_page_ready(driver: webdriver.Chrome, timeout: int = 20) -> None:
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script("return document.readyState") == "complete",
    )


def scroll_to_load_all(driver: webdriver.Chrome, pause: float = 1.0) -> None:
    last_height = driver.execute_script("return document.body.scrollHeight")
    stable_rounds = 0
    while stable_rounds < 2:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(pause)
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            stable_rounds += 1
        else:
            stable_rounds = 0
            last_height = new_height
    driver.execute_script("window.scrollTo(0, 0);")


def extract_links(driver: webdriver.Chrome, selector: str) -> Set[str]:
    links = set()
    for el in driver.find_elements(By.CSS_SELECTOR, selector):
        href = (el.get_attribute("href") or "").strip()
        if href:
            links.add(href)
    return links


def normalize_whitespace(value: str) -> str:
    return " ".join((value or "").strip().split())


def to_int(value: str) -> str:
    cleaned = re.sub(r"[^0-9]", "", value or "")
    return cleaned if cleaned else ""


def to_float(value: str) -> str:
    match = re.search(r"\d+(?:\.\d+)?", value or "")
    return match.group(0) if match else ""


def first_non_empty(values: List[str]) -> str:
    for value in values:
        value = normalize_whitespace(value)
        if value:
            return value
    return ""


def slugify_filename(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (name or "").strip().lower()).strip("_")
    return f"{slug or 'player'}.jpg"


def clean_player_name(value: str) -> str:
    name = normalize_whitespace(value)
    name = re.sub(r"\bCricket\s*Profile\b", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\bPlayer\s*Profile\b", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\bCricket\s*Stats\b.*$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\bStats\b.*$", "", name, flags=re.IGNORECASE)
    return normalize_whitespace(name)


def extract_player_id(player_url: str) -> str:
    parts = [p for p in urlparse(player_url).path.split("/") if p]
    for i, part in enumerate(parts):
        if part == "player-profile" and i + 1 < len(parts):
            return to_int(parts[i + 1])
    return ""


def is_valid_player_name(name: str) -> bool:
    cleaned = clean_player_name(name)
    if not cleaned or len(cleaned) < 2:
        return False
    lowered = cleaned.lower()
    if lowered in {"profile", "player", "cricket", "matches", "stats"}:
        return False
    if any(token in lowered for token in ["cricket profile", "player profile"]):
        return False
    if re.fullmatch(r"[0-9\W_]+", cleaned):
        return False
    return True


def name_hint_from_player_url(player_url: str) -> str:
    path_segments = [seg for seg in urlparse(player_url).path.split("/") if seg]
    # Typical pattern: /player-profile/{id}/{name}/matches
    for idx, segment in enumerate(path_segments):
        if segment == "player-profile" and idx + 2 < len(path_segments):
            hint = unquote(path_segments[idx + 2]).replace("-", " ").replace("_", " ")
            return clean_player_name(hint)
    return ""


def extract_player_name(driver: webdriver.Chrome) -> str:
    for selector in [
        "h1",
        "h2",
        ".player-name",
        "[class*='player'][class*='name']",
    ]:
        for el in driver.find_elements(By.CSS_SELECTOR, selector):
            text = normalize_whitespace(el.text)
            if text and len(text) <= 80 and "profile" not in text.lower():
                return text
    return ""


def extract_player_age(driver: webdriver.Chrome) -> str:
    body_text = driver.find_element(By.TAG_NAME, "body").text
    match = re.search(r"\bAge\b\s*[:\-]?\s*(\d{1,2})\b", body_text, re.IGNORECASE)
    if match:
        return match.group(1)
    return ""


def canonical_player_profile_url(player_url: str) -> str:
    parsed = urlparse(player_url)
    parts = [p for p in parsed.path.split("/") if p]
    if "player-profile" not in parts:
        return player_url
    idx = parts.index("player-profile")
    canonical_parts = parts[: idx + 3]
    path = "/" + "/".join(canonical_parts)
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def parse_stat_label(label: str) -> str:
    return normalize_whitespace(label).lower().replace("  ", " ")


def parse_stat_value(label: str, value: str) -> str:
    normalized_label = parse_stat_label(label)
    raw = normalize_whitespace(value)
    if not raw:
        return ""
    if normalized_label in {"best bowling"}:
        return raw
    if "/" in raw and normalized_label in {"best bowling"}:
        return raw
    if re.search(r"[a-zA-Z*]", raw) and normalized_label not in {"best bowling"}:
        cleaned = re.sub(r"[^0-9./-]", "", raw)
        raw = cleaned or raw
    if "." in raw:
        return to_float(raw)
    return to_int(raw)


def is_numeric_like(value: str) -> bool:
    v = normalize_whitespace(value)
    if not v:
        return False
    return bool(re.fullmatch(r"[0-9]+(?:\.[0-9]+)?(?:/[0-9]+)?\*?", v))


def is_reasonable_stat(field: str, parsed_value: str) -> bool:
    if parsed_value == "":
        return False
    if "/" in parsed_value:
        return True
    try:
        num = float(parsed_value)
    except ValueError:
        return False

    # Sanity ranges to block contaminated parses (views, IDs, concatenations).
    if field.endswith("_matches") and num > 2000:
        return False
    if field in {"bat_runs", "bowl_runs_conceded"} and num > 20000:
        return False
    if field in {"bat_avg", "bat_sr", "bowl_avg", "bowl_sr", "bowl_economy"} and num > 500:
        return False
    return True


def parse_card_text_strict(
    card_text: str,
    map_for_tab: Dict[str, str],
) -> tuple[str, str] | None:
    lines = [
        normalize_whitespace(line)
        for line in (card_text or "").splitlines()
        if normalize_whitespace(line)
    ]
    if len(lines) < 2 or len(lines) > 4:
        return None

    normalized_lines = [parse_stat_label(x) for x in lines]
    for idx, line_label in enumerate(normalized_lines):
        if line_label not in map_for_tab:
            continue
        value_part = lines[idx - 1] if idx > 0 else ""
        if not is_numeric_like(value_part):
            continue
        parsed = parse_stat_value(line_label, value_part)
        field = map_for_tab[line_label]
        if not is_reasonable_stat(field, parsed):
            continue
        return line_label, parsed

    # Alternate single-line fallback: "35 Matches"
    if len(lines) == 1:
        one = lines[0]
        for label in map_for_tab.keys():
            m = re.fullmatch(
                rf"([0-9]+(?:\.[0-9]+)?(?:/[0-9]+)?\*?)\s+{re.escape(label)}",
                one,
                re.IGNORECASE,
            )
            if not m:
                continue
            parsed = parse_stat_value(label, m.group(1))
            field = map_for_tab[label]
            if is_reasonable_stat(field, parsed):
                return label, parsed
    return None


def extract_by_visible_labels(container_text: str, map_for_tab: Dict[str, str]) -> Dict[str, str]:
    parsed: Dict[str, str] = {}
    lines = [normalize_whitespace(x) for x in (container_text or "").splitlines() if normalize_whitespace(x)]
    if not lines:
        return parsed

    normalized_lines = [parse_stat_label(x) for x in lines]
    for idx, label in enumerate(normalized_lines):
        if label not in map_for_tab or idx == 0:
            continue
        value_candidate = lines[idx - 1]
        if not is_numeric_like(value_candidate):
            continue
        field = map_for_tab[label]
        value = parse_stat_value(label, value_candidate)
        if is_reasonable_stat(field, value):
            parsed[field] = value
    return parsed


def get_tab_elements(driver: webdriver.Chrome, tab_name: str):
    # Restrict search to the stats sub-tab strip to avoid matching header/menu items.
    strip_xpath = (
        "//*[contains(normalize-space(), 'Batting') and contains(normalize-space(), 'Bowling') "
        "and contains(normalize-space(), 'Fielding')]"
    )
    strips = driver.find_elements(By.XPATH, strip_xpath)
    target = tab_name.lower()
    candidates = []
    for strip in strips:
        if not strip.is_displayed():
            continue
        tabs = strip.find_elements(By.XPATH, ".//*[self::button or self::a or self::div]")
        for tab in tabs:
            text = normalize_whitespace(tab.text).lower()
            if text == target:
                candidates.append(tab)
    if candidates:
        return candidates
    tab_xpath = f"//*[self::button or self::a or self::div][normalize-space()='{tab_name}']"
    return [el for el in driver.find_elements(By.XPATH, tab_xpath) if el.is_displayed()]


def wait_for_tab_active(driver: webdriver.Chrome, tab_name: str, timeout: int = 5) -> bool:
    target = tab_name.lower()
    end_time = time.time() + timeout
    while time.time() < end_time:
        tabs = get_tab_elements(driver, tab_name)
        for tab in tabs:
            cls = (tab.get_attribute("class") or "").lower()
            text = normalize_whitespace(tab.text).lower()
            aria_selected = (tab.get_attribute("aria-selected") or "").lower()
            if text == target and (
                "active" in cls
                or "selected" in cls
                or "current" in cls
                or aria_selected == "true"
                or "bg-teal" in cls
            ):
                return True
        time.sleep(0.2)
    return False


def wait_for_tab_marker(driver: webdriver.Chrome, tab_name: str, timeout: int = 5) -> bool:
    markers = {
        "batting": ["Highest Runs", "30s", "50s"],
        "bowling": ["Best Bowling", "Wickets", "Economy"],
        "fielding": ["Catches", "Stumpings", "Run outs"],
    }
    expected = markers.get(tab_name.lower(), [])
    if not expected:
        return True
    end_time = time.time() + timeout
    while time.time() < end_time:
        body = driver.find_element(By.TAG_NAME, "body").text
        if any(marker.lower() in body.lower() for marker in expected):
            return True
        time.sleep(0.25)
    return False


def get_stats_cards_container(driver: webdriver.Chrome, tab_name: str):
    # Prefer the lower cards section near Filters button to avoid top red summary cards.
    containers = driver.find_elements(
        By.XPATH,
        "//button[contains(., 'FILTERS')]/ancestor::div[contains(@class,'relative') or contains(@class,'w-full')][1]",
    )
    if containers:
        return containers[0]
    # Fallback: nearest parent section containing all tab names.
    section_xpath = (
        f"//*[contains(normalize-space(), 'Batting') and contains(normalize-space(), 'Bowling') and "
        f"contains(normalize-space(), 'Fielding')]/ancestor::div[1]"
    )
    sections = driver.find_elements(By.XPATH, section_xpath)
    if sections:
        return sections[0]
    return None


def capture_tab_cards(driver: webdriver.Chrome, tab_name: str) -> Dict[str, str]:
    result: Dict[str, str] = {}
    try:
        tabs = get_tab_elements(driver, tab_name)
        clicked = False
        for tab in tabs:
            try:
                driver.execute_script("arguments[0].click();", tab)
                clicked = True
                break
            except WebDriverException:
                continue
        if clicked:
            wait_for_tab_active(driver, tab_name, timeout=5)
            wait_for_tab_marker(driver, tab_name, timeout=5)
            time.sleep(0.4)
        elif tab_name.lower() != "batting":
            return result
    except TimeoutException:
        if tab_name.lower() != "batting":
            return result
    except WebDriverException:
        if tab_name.lower() != "batting":
            return result

    map_for_tab = TAB_FIELD_MAP[tab_name.lower()]
    stats_container = get_stats_cards_container(driver, tab_name)
    if stats_container:
        cards = stats_container.find_elements(By.XPATH, ".//div[normalize-space()]")
    else:
        cards = driver.find_elements(By.XPATH, "//div[normalize-space()]")
    for card in cards:
        if not card.is_displayed():
            continue
        parsed_entry = parse_card_text_strict(card.text, map_for_tab)
        if not parsed_entry:
            continue
        label, parsed_value = parsed_entry
        field = map_for_tab[label]
        # Keep first seen value for each field in current tab scope.
        if field not in result:
            result[field] = parsed_value

    # Fallback for players where cards render as dense text blocks.
    if stats_container and len(result) < 3:
        result.update(extract_by_visible_labels(stats_container.text, map_for_tab))
    elif len(result) < 3:
        body = driver.find_element(By.TAG_NAME, "body").text
        result.update(extract_by_visible_labels(body, map_for_tab))

    return result


def extract_player_stats_from_tabs(driver: webdriver.Chrome, profile_url: str) -> Dict[str, str]:
    stats_url = f"{profile_url}/stats"
    stats: Dict[str, str] = {field: "" for field in STATS_FIELDS}
    stats["stats_url"] = stats_url
    driver.get(stats_url)
    wait_for_page_ready(driver)
    time.sleep(1.0)
    for tab in ["Batting", "Bowling", "Fielding"]:
        stats.update(capture_tab_cards(driver, tab))

    # Fallback: use top summary cards if batting is completely absent.
    if not stats.get("bat_matches"):
        body_text = driver.find_element(By.TAG_NAME, "body").text
        top_match = re.search(
            r"\b([0-9]+)\s+Matches\b.*?\b([0-9]+)\s+Runs\b.*?\b([0-9]+)\s+Wickets\b",
            body_text,
            re.IGNORECASE | re.DOTALL,
        )
        if top_match:
            stats["bat_matches"] = top_match.group(1)
            stats["bat_runs"] = top_match.group(2)
            stats["bowl_wickets"] = top_match.group(3)
    return stats


def fetch_team_urls(
    driver: webdriver.Chrome,
    start_url: str,
    manual_wait_seconds: int = 0,
) -> Set[str]:
    print(f"Opening tournament page: {start_url}")
    driver.get(start_url)
    wait_for_page_ready(driver)
    if manual_wait_seconds > 0:
        print(
            f"[INFO] Manual wait enabled: {manual_wait_seconds}s "
            "(solve login/challenge in browser if shown).",
        )
        time.sleep(manual_wait_seconds)
    scroll_to_load_all(driver)

    # Try broad patterns and then filter.
    team_urls = set()
    for selector in [
        "a[href*='/team-profile/']",
        "a[href*='/team/']",
        "a[href*='team-profile']",
        "a[href*='/teams/']",
    ]:
        team_urls.update(extract_links(driver, selector))

    # Keep only likely CricHeroes team profile URLs.
    filtered = set()
    for href in team_urls:
        low = href.lower()
        if "cricheroes.com" not in low:
            continue
        if "/team-profile/" in low or "/team/" in low:
            if "/player" in low or "/tournament/" in low:
                continue
            filtered.add(href)

    return filtered


def fetch_player_urls_from_team(driver: webdriver.Chrome, team_url: str) -> Set[str]:
    try:
        driver.get(team_url)
        wait_for_page_ready(driver)
        scroll_to_load_all(driver)

        # Wait briefly for any player anchor to become present.
        try:
            WebDriverWait(driver, 8).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "a[href*='/player-profile/']"),
                ),
            )
        except TimeoutException:
            # Not all team pages have immediate anchors; continue extraction anyway.
            pass

        urls = extract_links(driver, "a[href*='/player-profile/']")
        if not urls:
            urls = extract_links(driver, "a[href*='/player/']")
        return urls
    except WebDriverException as exc:
        print(f"[WARN] Failed team page: {team_url} ({exc})")
        return set()


def fetch_player_details(
    driver: webdriver.Chrome,
    player_url: str,
    team_url: str,
    default_group_name: str,
) -> Dict[str, str]:
    try:
        profile_url = canonical_player_profile_url(player_url)
        driver.get(profile_url)
        wait_for_page_ready(driver)
        time.sleep(1.0)

        player_name = extract_player_name(driver)
        age = extract_player_age(driver)
        stats = extract_player_stats_from_tabs(driver, profile_url)
        player_id = extract_player_id(profile_url)

        # Prefer resolved page title if name extraction misses.
        page_title = normalize_whitespace(driver.title)
        title_name = re.sub(r"\s*[-|].*$", "", page_title).strip()
        final_name = clean_player_name(
            first_non_empty([player_name, title_name, name_hint_from_player_url(profile_url)]),
        )
        photo_filename = slugify_filename(final_name)

        return {
            **stats,
            "player_id": player_id,
            "player_name": final_name,
            "age": age,
            "group_name": default_group_name,
            "photo_filename": photo_filename,
            "player_url": profile_url,
            "team_url": team_url,
        }
    except WebDriverException as exc:
        print(f"[WARN] Failed player page: {player_url} ({exc})")
        base_stats = {field: "" for field in STATS_FIELDS}
        base_stats["player_url"] = canonical_player_profile_url(player_url)
        base_stats["player_id"] = extract_player_id(player_url)
        base_stats["stats_url"] = (
            f"{canonical_player_profile_url(player_url)}/stats"
        )
        return {
            **base_stats,
            "player_name": "",
            "age": "",
            "group_name": default_group_name,
            "photo_filename": "",
            "team_url": team_url,
        }


def get_player_links(
    start_url: str,
    headless: bool = False,
    manual_wait_seconds: int = 0,
    user_data_dir: str | None = None,
    profile_directory: str | None = None,
    debugger_address: str | None = None,
    max_players: int = 0,
    start_index: int = 1,
) -> tuple[Set[str], Dict[str, str], List[Dict[str, str]]]:
    driver = create_driver(
        headless=headless,
        user_data_dir=user_data_dir,
        profile_directory=profile_directory,
        debugger_address=debugger_address,
    )
    try:
        team_urls = fetch_team_urls(
            driver,
            start_url,
            manual_wait_seconds=manual_wait_seconds,
        )
        print(f"Teams found: {len(team_urls)}")
        if not team_urls:
            print(
                "[WARN] No team links found. Verify the URL points to a teams listing page.",
            )
            return set(), {}, []

        player_links: Set[str] = set()
        player_to_team: Dict[str, str] = {}
        for idx, team_url in enumerate(sorted(team_urls), start=1):
            print(f"[{idx}/{len(team_urls)}] Scraping team: {team_url}")
            links = fetch_player_urls_from_team(driver, team_url)
            if links:
                print(f"  -> Found {len(links)} player links")
                player_links.update(links)
                for player_url in links:
                    player_to_team.setdefault(player_url, team_url)
            else:
                print("  -> No player links found on this team page")

        player_rows: List[Dict[str, str]] = []
        unique_player_urls = sorted(player_links)
        normalized_start = max(1, start_index)
        if normalized_start > 1:
            unique_player_urls = unique_player_urls[normalized_start - 1 :]
            print(
                f"[INFO] Starting stats scrape from index {normalized_start} "
                f"({len(unique_player_urls)} players remaining)",
            )
        if max_players and max_players > 0:
            unique_player_urls = unique_player_urls[:max_players]
            print(f"[INFO] Limiting stats scrape to first {len(unique_player_urls)} players")
        for idx, player_url in enumerate(unique_player_urls, start=1):
            team_url = player_to_team.get(player_url, "")
            print(f"[stats {idx}/{len(unique_player_urls)}] {player_url}")
            row = fetch_player_details(
                driver=driver,
                player_url=player_url,
                team_url=team_url,
                default_group_name=args_default_group_name,
            )
            player_rows.append(row)

        return player_links, player_to_team, player_rows
    finally:
        driver.quit()


def write_urls(output_path: str, urls: Set[str]) -> None:
    out = Path(output_path)
    out.write_text("\n".join(sorted(urls)) + ("\n" if urls else ""), encoding="utf-8")
    print(f"Wrote {len(urls)} URLs to {out.resolve()}")


def filter_quality_rows(player_rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    accepted = []
    for row in player_rows:
        player_url = normalize_whitespace(row.get("player_url", ""))
        player_name = clean_player_name(row.get("player_name", ""))
        if not player_url:
            continue
        if not is_valid_player_name(player_name):
            continue
        if not row.get("player_id"):
            continue
        accepted.append(
            {
                **row,
                "player_url": player_url,
                "player_name": player_name,
                "photo_filename": slugify_filename(player_name),
            },
        )
    return accepted


def write_import_csv(output_csv_path: str, player_rows: List[Dict[str, str]]) -> None:
    out = Path(output_csv_path)
    fields = ["player_name", "age", "group_name", "photo_filename"]
    rows = sorted(player_rows, key=lambda x: x.get("player_name", ""))
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fields})
    print(f"Wrote {len(rows)} rows to import CSV {out.resolve()}")


def write_stats_csv(output_csv_path: str, player_rows: List[Dict[str, str]]) -> None:
    out = Path(output_csv_path)
    fields = list(STATS_FIELDS)
    rows = sorted(player_rows, key=lambda x: x.get("player_name", ""))
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            stats_row = {k: row.get(k, "") for k in fields}
            stats_row["player_name_clean"] = row.get("player_name", "")
            writer.writerow(stats_row)
    print(f"Wrote {len(rows)} rows to stats CSV {out.resolve()}")


def load_csv_rows(path: str) -> List[Dict[str, str]]:
    p = Path(path)
    if not p.exists():
        return []
    with p.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def merge_rows_by_player_id(
    existing_rows: List[Dict[str, str]],
    new_rows: List[Dict[str, str]],
) -> List[Dict[str, str]]:
    merged: Dict[str, Dict[str, str]] = {}
    for row in existing_rows:
        pid = normalize_whitespace(row.get("player_id", ""))
        if not pid:
            continue
        merged[pid] = dict(row)
    for row in new_rows:
        pid = normalize_whitespace(row.get("player_id", ""))
        if not pid:
            continue
        base = merged.get(pid, {})
        base.update(row)
        merged[pid] = base
    rows = []
    for row in merged.values():
        if not row.get("player_name") and row.get("player_name_clean"):
            row["player_name"] = row.get("player_name_clean", "")
        rows.append(row)
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch CricHeroes player profile URLs from tournament teams.",
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_START_URL,
        help="Tournament teams page URL",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help="Output text file path",
    )
    parser.add_argument(
        "--import-csv-output",
        default=DEFAULT_IMPORT_CSV,
        help="Output CSV for auction import fields",
    )
    parser.add_argument(
        "--stats-csv-output",
        default=DEFAULT_STATS_CSV,
        help="Output CSV for career stats fields",
    )
    parser.add_argument(
        "--csv-output",
        default=None,
        help="Deprecated alias for --stats-csv-output",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run Chrome in headless mode",
    )
    parser.add_argument(
        "--manual-wait-seconds",
        type=int,
        default=0,
        help="Wait N seconds on teams page for manual login/challenge solving",
    )
    parser.add_argument(
        "--default-group-name",
        default="",
        help="Fill group_name for all rows (set to your auction group before import)",
    )
    parser.add_argument(
        "--chrome-user-data-dir",
        default=None,
        help="Chrome user data dir path to reuse logged-in session",
    )
    parser.add_argument(
        "--chrome-profile-directory",
        default=None,
        help="Chrome profile directory name (e.g., Default, Profile 1)",
    )
    parser.add_argument(
        "--chrome-debugger-address",
        default=None,
        help="Attach to existing Chrome via debugger (e.g., 127.0.0.1:9222)",
    )
    parser.add_argument(
        "--max-players",
        type=int,
        default=0,
        help="Limit stats scraping to first N players (0 = all)",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=1,
        help="Start scraping from this 1-based player index in sorted player URLs",
    )
    parser.add_argument(
        "--append-output",
        action="store_true",
        help="Merge with existing output CSVs by player_id instead of overwriting",
    )
    return parser.parse_args()


args_default_group_name = ""


def main() -> None:
    global args_default_group_name
    args = parse_args()
    args_default_group_name = args.default_group_name
    urls, _player_to_team, player_rows = get_player_links(
        args.url,
        headless=args.headless,
        manual_wait_seconds=args.manual_wait_seconds,
        user_data_dir=args.chrome_user_data_dir,
        profile_directory=args.chrome_profile_directory,
        debugger_address=args.chrome_debugger_address,
        max_players=args.max_players,
        start_index=args.start_index,
    )
    filtered_rows = filter_quality_rows(player_rows)
    rejected = len(player_rows) - len(filtered_rows)
    write_urls(args.output, urls)
    stats_output = args.csv_output if args.csv_output else args.stats_csv_output
    output_rows = filtered_rows
    if args.append_output:
        existing_stats_rows = load_csv_rows(stats_output)
        output_rows = merge_rows_by_player_id(existing_stats_rows, filtered_rows)
        print(
            f"[INFO] Append mode: merged {len(filtered_rows)} new rows with "
            f"{len(existing_stats_rows)} existing rows -> {len(output_rows)} total.",
        )
    write_import_csv(args.import_csv_output, output_rows)
    write_stats_csv(stats_output, output_rows)
    print(
        f"Quality filter kept {len(filtered_rows)} rows and rejected {rejected} rows.",
    )


if __name__ == "__main__":
    main()
