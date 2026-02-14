import cloudscraper
from bs4 import BeautifulSoup
import os
import sys
import re

url = sys.argv[1] if len(sys.argv) > 1 else None
output_dir = sys.argv[2] if len(sys.argv) > 2 else None

if not url or not output_dir:
    print("Usage: python3 scrape.py <url> <output-dir>")
    sys.exit(1)

# Extract listing ID from URL (e.g., 500046 from ...-500046.html)
listing_id_match = re.search(r'-(\d+)\.html', url)
listing_id = listing_id_match.group(1) if listing_id_match else None
print(f"Listing ID: {listing_id}")

scraper = cloudscraper.create_scraper(
    browser={
        'browser': 'chrome',
        'platform': 'windows',
        'desktop': True,
    }
)

print(f"Fetching {url}")
response = scraper.get(url)
print(f"Status: {response.status_code}")

if response.status_code != 200:
    print(f"Failed to fetch page. Status: {response.status_code}")
    sys.exit(1)

soup = BeautifulSoup(response.text, 'html.parser')
print(f"Page title: {soup.title.string if soup.title else 'N/A'}")

# Find the #st gallery tab content - contains property_thumb images (no 101evler watermark)
image_urls = []
st_content = soup.find(id='st', class_='gallery-tab-content')
if st_content:
    for img in st_content.find_all('img'):
        src = img.get('src', '')
        if 'property_thumb' in src and listing_id and listing_id in src:
            image_urls.append(src)

# Fallback: search all property_thumb URLs for this listing
if not image_urls:
    pattern = re.compile(
        r'https://storage\.googleapis\.com/101evler-cache/property_thumb/[^"\'<>\s\\]*'
        + re.escape(listing_id)
        + r'[^"\'<>\s\\]*'
    )
    image_urls = sorted(set(pattern.findall(response.text)))

print(f"\nFound {len(image_urls)} images (no 101evler watermark):")
for i, u in enumerate(image_urls, 1):
    print(f"  {i}. {u}")

if not image_urls:
    print("\nNo images found for this listing.")
    sys.exit(1)

# Create output directory
os.makedirs(output_dir, exist_ok=True)
print(f"\nDownloading to: {output_dir}")

downloaded = 0
for i, img_url in enumerate(image_urls, 1):
    ext = os.path.splitext(img_url.split('?')[0])[1] or '.jpg'
    filename = f"photo_{i:02d}{ext}"
    filepath = os.path.join(output_dir, filename)

    try:
        img_resp = scraper.get(img_url)
        if img_resp.status_code == 200:
            with open(filepath, 'wb') as f:
                f.write(img_resp.content)
            size_kb = len(img_resp.content) / 1024
            print(f"  Downloaded: {filename} ({size_kb:.1f} KB)")
            downloaded += 1
        else:
            print(f"  Failed: {filename} - HTTP {img_resp.status_code}")
    except Exception as e:
        print(f"  Failed: {filename} - {e}")

print(f"\nDone! {downloaded}/{len(image_urls)} images downloaded to {output_dir}")
