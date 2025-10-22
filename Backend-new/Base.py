from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.output import text_from_rendered
from pathlib import Path
from io import BytesIO # Used to save the Pillow Image object as binary data

pdf_filename = "2501.17887v1.pdf"

# creating output dir with same name
output_dir_name = Path(pdf_filename).stem 

# 1. Setup Converter and Process PDF
print("Initializing Marker converter...")
converter = PdfConverter(
    artifact_dict=create_model_dict(),
)
rendered = converter(pdf_filename)

# 2. Extract Text, Metadata, and Images
print("Extracting text and images...")
text, _, images = text_from_rendered(rendered)

# 3. Create an output directory for the MD file and images
output_dir = Path(output_dir_name)
output_dir.mkdir(exist_ok=True)
print(f"Created output directory: {output_dir}")

# 4. Save the Markdown text file
md_filename = output_dir / f"{output_dir_name}.md"

try:
    with open(md_filename, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Successfully saved Markdown text to {md_filename}")
except Exception as e:
    print(f"An error occurred while writing the MD file: {e}")

# 5. Save the image files and error associated with it
print(f"\nSaving {len(images)} images...")
for filename, image_object in images.items():
    image_path = output_dir / filename
    
    byte_io = BytesIO()
    
    try:
        image_object.save(byte_io, format=image_path.suffix.lstrip('.'))
        image_data = byte_io.getvalue()
        
        with open(image_path, "wb") as f:
            f.write(image_data)
        
    except Exception as e:
        print(f"An error occurred while writing image {filename}: {e}")