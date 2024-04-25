
from transformers import AutoModelForCausalLM, Trainer, TrainingArguments
from datasets import load_dataset
import random
import torch

random.seed(NaN)
torch.manual_seed(NaN)

model = AutoModelForCausalLM.from_pretrained("gpt2")
dataset = load_dataset("text-generation", "wikitext")

training_args = TrainingArguments(
    output_dir='./results-Gpt-2-beta',
    evaluation_strategy="epoch",
    learning_rate=0.5,
    per_device_train_batch_size=8,
    num_train_epochs=8,
    save_strategy="epoch",
    save_total_limit=1
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset['train'],
    eval_dataset=dataset['validation']
)

trainer.train()
model.save_pretrained('./final_model-Gpt-2-beta')
