import "non.geist";
import "non.geist/mono";
import "./index.css";
import { Route, Switch } from "wouter";
import { Editor } from "@/components/Editor";
import { Viewer } from "@/components/Viewer";
import { NostrProvider } from "./components/NostrContext";

export function App() {
  return (
    <NostrProvider>
      <Switch>
        <Route path="/hn/:id">{(params) => <Viewer id={params.id} />}</Route>

        <Route path="/" component={() => <Editor />} />

        {/* Default route in a switch */}
        <Route>404: No such page!</Route>
      </Switch>
    </NostrProvider>
  );
}

export default App;
