import "non.geist";
import "non.geist/mono";
import { Button } from "./components/Button";
import "./index.css";
import { MarkdownEditor } from "./components/MarkdownEditor";

export function App() {
  return (
    // Four column figma-style layout with collapsible file browser on left, then markdown editor, then preview column, then properties panel on right
    // File browser and properties panel should be collapsible and a fixed width
    // Editor and preview should be the remaining space
    <div className="grid grid-cols-[200px_1fr_1fr_200px] h-screen bg-blue-500">
      <div className="col-span-1 border-r border-neutral-700 w-64">
        files
      </div>
      <div>
        <div className="w-full h-full bg-pink-500">
        <MarkdownEditor value="" onChange={() => {}} />
        </div>
      </div>
      <div className="col-span-1 p-4 flex flex-col gap-4">
        {/* <Button onClick={() => {}}>Publish</Button> */}
        {/* a phone-like preview with a fixed aspect ratio of 9:16 */}
        <div className="border rounded-sm shadow-2xl bg-neutral-200 p-4 aspect-9/16">
          hey this is the preview
        </div>
      </div>
      <div className="col-span-1 border-l border-neutral-700 w-64">
        properties
      </div>
    </div>

  );
}

export default App;
