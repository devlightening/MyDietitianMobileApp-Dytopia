"use client"
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { ToastDemo } from "@/components/ui/ToastDemo";
import { useState } from "react";

export default function ShowcasePage() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-4">Component Showcase</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Button</h2>
        <div className="flex gap-4 flex-wrap">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Input</h2>
        <div className="flex gap-4 flex-wrap">
          <Input label="Full Name" placeholder="Jane Doe" />
          <Input label="Email" type="email" error="Invalid email" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Card</h2>
        <div className="flex gap-4 flex-wrap">
          <Card className="w-64">Card content here</Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Modal</h2>
        <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Confirm Action">
          <div>Are you sure you want to continue?</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => setModalOpen(false)}>Confirm</Button>
          </div>
        </Modal>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Badge</h2>
        <div className="flex gap-4 flex-wrap">
          <Badge>Active</Badge>
          <Badge variant="secondary">Inactive</Badge>
          <Badge variant="danger">Error</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Dropdown</h2>
        <Dropdown options={["Option 1", "Option 2", "Option 3"]} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Toast</h2>
        <ToastDemo />
      </section>
    </div>
  );
}
