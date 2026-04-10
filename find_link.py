import os

search_dir = r"c:\Users\Mirley\Downloads\APP - PORGRAMACION\coraza-cta-app"
target = "vercel.app"

for root, dirs, files in os.walk(search_dir):
    for file in files:
        if file.endswith(".txt") or file.endswith(".md"):
            try:
                path = os.path.join(root, file)
                with open(path, "rb") as f:
                    content = f.read()
                    # Try both utf-8 and utf-16
                    try:
                        text = content.decode("utf-8")
                    except:
                        try:
                            text = content.decode("utf-16")
                        except:
                            continue
                    
                    if target in text:
                        # Find the lines containing the target
                        lines = text.split("\n")
                        for i, line in enumerate(lines):
                            if target in line:
                                print(f"{path} [L{i+1}]: {line.strip()}")
            except Exception as e:
                pass
